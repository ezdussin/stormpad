import { useId, useState, type FormEvent } from 'react'
import {
  createNote,
  createNoteFolder,
  DEFAULT_NOTE_FOLDER,
  folderLabel,
  moveNote,
  renameNote,
} from '../db/notes'
import {
  dirOf,
  fileNameOf,
  normalizeFileName,
  normalizeNoteFolder,
  NOTES_ROOT,
  slugify,
  timestampSlug,
  validateFileName,
  validateFolderName,
} from '../lib/paths'
import { Modal } from './Modal'
import { TagInput } from './TagInput'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-500'

function DialogButtons({ formId, submitLabel, onCancel }: { formId: string; submitLabel: string; onCancel: () => void }) {
  return (
    <>
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500"
      >
        {submitLabel}
      </button>
    </>
  )
}

function FileNameField({ folder, value, onChange }: { folder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-zinc-400">Nome do arquivo</span>
      <input data-autofocus className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="block truncate text-xs text-zinc-600">
        {folder}
        {normalizeFileName(value) || '…'}.md
      </span>
    </label>
  )
}

function FolderSelect({
  folders,
  value,
  onChange,
}: {
  folders: string[]
  value: string
  onChange: (folder: string) => void
}) {
  const options = folders.includes(value) ? folders : [...folders, value].sort()
  return (
    <label className="block space-y-1">
      <span className="text-zinc-400">Pasta</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((folder) => (
          <option key={folder} value={folder}>
            {folderLabel(folder)}
          </option>
        ))}
      </select>
    </label>
  )
}

interface NewNoteModalProps {
  tagSuggestions: string[]
  folders: string[]
  initialFolder?: string
  onCreated: (path: string) => void
  onClose: () => void
}

export function NewNoteModal({
  tagSuggestions,
  folders,
  initialFolder = DEFAULT_NOTE_FOLDER,
  onCreated,
  onClose,
}: NewNoteModalProps) {
  const formId = useId()
  const [folder, setFolder] = useState(() => normalizeNoteFolder(initialFolder))
  const [name, setName] = useState(() => timestampSlug(new Date()))
  const [nameTouched, setNameTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function handleTitleChange(next: string) {
    setTitle(next)
    if (!nameTouched && slugify(next)) setName(slugify(next))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateFileName(name)
    if (invalid) return setError(invalid)
    try {
      onCreated(await createNote({ name, title, tags, folder }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal title="Nova nota" onClose={onClose} footer={<DialogButtons formId={formId} submitLabel="Criar" onCancel={onClose} />}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FolderSelect folders={folders} value={folder} onChange={setFolder} />
        <FileNameField
          folder={folder}
          value={name}
          onChange={(value) => {
            setName(value)
            setNameTouched(true)
            setError(null)
          }}
        />
        <label className="block space-y-1">
          <span className="text-zinc-400">
            Título <span className="text-zinc-600">(opcional, vira o # dentro da nota)</span>
          </span>
          <input className={inputClass} value={title} onChange={(e) => handleTitleChange(e.target.value)} />
        </label>
        <div className="space-y-1">
          <span className="text-zinc-400">Tags</span>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="Adicionar tag…" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

interface RenameNoteModalProps {
  path: string
  onRenamed: (path: string) => void
  onClose: () => void
}

export function RenameNoteModal({ path, onRenamed, onClose }: RenameNoteModalProps) {
  const formId = useId()
  const [name, setName] = useState(() => fileNameOf(path))
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateFileName(name)
    if (invalid) return setError(invalid)
    try {
      onRenamed(await renameNote(path, name))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal
      title="Renomear nota"
      onClose={onClose}
      footer={<DialogButtons formId={formId} submitLabel="Renomear" onCancel={onClose} />}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        <FileNameField
          folder={dirOf(path)}
          value={name}
          onChange={(value) => {
            setName(value)
            setError(null)
          }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

interface MoveNoteModalProps {
  path: string
  folders: string[]
  onMoved: (path: string) => void
  onClose: () => void
}

export function MoveNoteModal({ path, folders, onMoved, onClose }: MoveNoteModalProps) {
  const formId = useId()
  const [folder, setFolder] = useState(() => dirOf(path))
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      onMoved(await moveNote(path, folder))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal title="Mover nota" onClose={onClose} footer={<DialogButtons formId={formId} submitLabel="Mover" onCancel={onClose} />}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-zinc-400">
          Mover <strong className="text-zinc-200">{fileNameOf(path)}</strong> para:
        </p>
        <FolderSelect
          folders={folders}
          value={folder}
          onChange={(value) => {
            setFolder(value)
            setError(null)
          }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

interface NewFolderModalProps {
  parentFolder?: string
  onCreated: (folder: string) => void
  onClose: () => void
}

export function NewFolderModal({ parentFolder = NOTES_ROOT, onCreated, onClose }: NewFolderModalProps) {
  const formId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const parent = normalizeNoteFolder(parentFolder)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateFolderName(name)
    if (invalid) return setError(invalid)
    try {
      onCreated(await createNoteFolder(parent, name))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal
      title="Nova pasta"
      onClose={onClose}
      footer={<DialogButtons formId={formId} submitLabel="Criar" onCancel={onClose} />}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-zinc-400">Nome da pasta</span>
          <input
            data-autofocus
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
          <span className="block truncate text-xs text-zinc-600">
            {parent}
            {name.trim() || '…'}/
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}
