import { useId, useState, type FormEvent } from 'react'
import { createNote, DEFAULT_NOTE_FOLDER, renameNote } from '../db/notes'
import { dirOf, fileNameOf, normalizeFileName, slugify, timestampSlug, validateFileName } from '../lib/paths'
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

interface NewNoteModalProps {
  tagSuggestions: string[]
  onCreated: (path: string) => void
  onClose: () => void
}

export function NewNoteModal({ tagSuggestions, onCreated, onClose }: NewNoteModalProps) {
  const formId = useId()
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
      onCreated(await createNote({ name, title, tags }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal title="Nova nota" onClose={onClose} footer={<DialogButtons formId={formId} submitLabel="Criar" onCancel={onClose} />}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FileNameField
          folder={DEFAULT_NOTE_FOLDER}
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
