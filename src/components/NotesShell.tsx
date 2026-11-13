import {
  AlignLeft,
  ClipboardCopy,
  CopyPlus,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  FolderTree,
  Heading,
  Link,
  PencilLine,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import type { Note } from '../db/db'
import { deleteNote, duplicateNote, useNote, useNotes } from '../db/notes'
import { getSetting, setSetting, type RepoConfig } from '../db/settings'
import { copyText } from '../lib/clipboard'
import { stripFrontmatter } from '../lib/frontmatter'
import { fileNameOf } from '../lib/paths'
import { normalizeTags } from '../lib/tags'
import { useSyncContext } from '../sync/SyncContext'
import type { MenuEntry } from './ContextMenu'
import { isToggleModeShortcut, TOGGLE_MODE_SHORTCUT, type EditorMode } from './editorMode'
import { ConfirmDialog } from './Modal'
import { NewNoteModal, RenameNoteModal } from './NoteDialogs'
import { NoteEditor } from './NoteEditor'
import { PropertiesModal } from './PropertiesModal'
import { useContextMenu } from './useContextMenu'

function githubUrl({ owner, repo, branch }: RepoConfig, path: string): string {
  const encode = (value: string) => value.split('/').map(encodeURIComponent).join('/')
  return `https://github.com/${owner}/${repo}/blob/${encode(branch)}/${encode(path)}`
}

function formatNoteDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString()
}

function matches(note: Note, query: string): boolean {
  const q = query.toLowerCase()
  return (
    fileNameOf(note.path).toLowerCase().includes(q) ||
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.tags.some((tag) => tag.toLowerCase().includes(q))
  )
}

export function NotesShell({ config }: { config: RepoConfig }) {
  const notes = useNotes()
  const { state, sync } = useSyncContext()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const selected = useNote(selectedPath)
  const menu = useContextMenu()
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)
  const [propertiesPath, setPropertiesPath] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const tagSuggestions = useMemo(() => normalizeTags(notes?.flatMap((note) => note.tags) ?? []), [notes])
  const propertiesNote = notes?.find((note) => note.path === propertiesPath)
  const savedMode = useLiveQuery(() => getSetting('editor_mode'))
  const mode: EditorMode = savedMode === 'code' ? 'code' : 'rich'

  function toggleMode() {
    void setSetting('editor_mode', mode === 'code' ? 'rich' : 'code')
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isToggleModeShortcut(event)) return
      event.preventDefault()
      void setSetting('editor_mode', mode === 'code' ? 'rich' : 'code')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  const visibleNotes = useMemo(
    () => (query ? notes?.filter((note) => matches(note, query)) : notes) ?? [],
    [notes, query],
  )

  function handleCreate() {
    setCreating(true)
  }

  async function confirmDelete(note: Note) {
    setPendingDelete(null)
    await deleteNote(note.path)
    if (selectedPath === note.path) setSelectedPath(null)
  }

  async function handleDuplicate(path: string) {
    const copyPath = await duplicateNote(path)
    if (copyPath) setSelectedPath(copyPath)
  }

  function noteActions(note: Note): MenuEntry[] {
    const onGitHub = note.sha !== null
    const url = githubUrl(config, note.path)
    return [
      { label: 'Copiar título', icon: Heading, onSelect: () => copyText(note.title) },
      { label: 'Copiar caminho', icon: FolderTree, onSelect: () => copyText(note.path) },
      { label: 'Copiar link do GitHub', icon: Link, disabled: !onGitHub, onSelect: () => copyText(url) },
      {
        label: 'Abrir no GitHub',
        icon: ExternalLink,
        disabled: !onGitHub,
        onSelect: () => void window.open(url, '_blank', 'noopener'),
      },
      'separator',
      { label: 'Renomear', icon: PencilLine, onSelect: () => setRenamingPath(note.path) },
      { label: 'Propriedades', icon: SlidersHorizontal, onSelect: () => setPropertiesPath(note.path) },
      { label: 'Duplicar', icon: CopyPlus, onSelect: () => handleDuplicate(note.path) },
      { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => setPendingDelete(note) },
    ]
  }

  function openNoteMenu(event: MouseEvent, note: Note) {
    menu.open(event, [
      { label: 'Abrir', icon: FileText, disabled: note.path === selectedPath, onSelect: () => setSelectedPath(note.path) },
      'separator',
      { label: 'Copiar conteúdo (Markdown)', icon: ClipboardCopy, onSelect: () => copyText(note.content) },
      {
        label: 'Copiar texto sem frontmatter',
        icon: AlignLeft,
        onSelect: () => copyText(stripFrontmatter(note.content).trimStart()),
      },
      ...noteActions(note),
    ])
  }

  function openListMenu(event: MouseEvent) {
    menu.open(event, [
      { label: 'Nova nota', icon: Plus, onSelect: handleCreate },
      {
        label: 'Sincronizar agora',
        icon: RefreshCw,
        disabled: state.status === 'syncing',
        onSelect: sync,
      },
    ])
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
          <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-sky-500"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={handleCreate} title="Nova nota" className="rounded-md p-1.5 hover:bg-zinc-800">
              <Plus size={18} />
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto" onContextMenu={openListMenu}>
            {visibleNotes.map((note) => (
              <li key={note.path}>
                <button
                  onClick={() => setSelectedPath(note.path)}
                  onContextMenu={(e) => openNoteMenu(e, note)}
                  className={`group flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-900 ${
                    note.path === selectedPath ? 'bg-zinc-900' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{fileNameOf(note.path)}</span>
                    <span
                      className="block truncate text-xs text-zinc-500"
                      title={new Date(note.updatedAt).toLocaleString()}
                    >
                      {formatNoteDate(note.updatedAt)}
                    </span>
                  </span>
                  {note.syncStatus !== 'synced' && (
                    <span
                      title={note.syncStatus}
                      className={`size-2 shrink-0 rounded-full ${
                        note.syncStatus === 'conflict' ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                <span className="min-w-0 flex-1 truncate">{fileNameOf(selected.path)}</span>
                <button
                  onClick={() => setPropertiesPath(selected.path)}
                  title="Propriedades"
                  className="rounded-md p-1.5 hover:bg-zinc-800"
                >
                  <SlidersHorizontal size={16} />
                </button>
                <button
                  onClick={toggleMode}
                  title={`${mode === 'rich' ? 'Ver código Markdown' : 'Ver formatado'} (${TOGGLE_MODE_SHORTCUT})`}
                  className="rounded-md p-1.5 hover:bg-zinc-800"
                >
                  {mode === 'rich' ? <FileCode size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => setPendingDelete(selected)}
                  title="Excluir nota"
                  className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <NoteEditor
                key={selected.path}
                note={selected}
                mode={mode}
                onToggleMode={toggleMode}
                menuEntries={noteActions(selected)}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              Selecione ou crie uma nota.
            </div>
          )}
        </main>
      </div>
      {menu.element}
      {propertiesNote && <PropertiesModal note={propertiesNote} onClose={() => setPropertiesPath(null)} />}
      {creating && (
        <NewNoteModal
          tagSuggestions={tagSuggestions}
          onCreated={(path) => {
            setCreating(false)
            setSelectedPath(path)
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {renamingPath && (
        <RenameNoteModal
          path={renamingPath}
          onRenamed={(path) => {
            if (selectedPath === renamingPath) setSelectedPath(path)
            setRenamingPath(null)
          }}
          onClose={() => setRenamingPath(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Excluir nota"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir <strong className="text-zinc-100">{fileNameOf(pendingDelete.path)}</strong>?{' '}
              {pendingDelete.sha === null
                ? 'Esta nota ainda não foi enviada ao GitHub e será perdida.'
                : 'Ela também será removida do GitHub no próximo sync.'}
            </p>
          }
          onConfirm={() => void confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
