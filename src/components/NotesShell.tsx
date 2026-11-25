import {
  AlignLeft,
  ChevronRight,
  ClipboardCopy,
  CopyPlus,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  FolderTree,
  Heading,
  Link,
  PencilLine,
  Plus,
  RefreshCw,
  Smile,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import type { Note } from '../db/db'
import {
  DEFAULT_NOTE_FOLDER,
  deleteNote,
  duplicateNote,
  folderLabel,
  setNoteIcon,
  useNote,
  useNoteFolders,
  useNotes,
} from '../db/notes'
import { DEFAULT_NOTE_ICON, resolveAppIcon, type AppIconId } from '../lib/appIcons'
import { getSetting, setSetting, type RepoConfig } from '../db/settings'
import { copyText } from '../lib/clipboard'
import { stripFrontmatter } from '../lib/frontmatter'
import {
  childFolderName,
  childFoldersOf,
  dirOf,
  fileNameOf,
  folderBreadcrumbs,
  normalizeNoteFolder,
  NOTES_ROOT,
} from '../lib/paths'
import { openExternal } from '../lib/openExternal'
import { normalizeTags } from '../lib/tags'
import { useSyncContext } from '../sync/SyncContext'
import type { MenuEntry } from './ContextMenu'
import { isToggleModeShortcut, TOGGLE_MODE_SHORTCUT, type EditorMode } from './editorMode'
import { IconPickerModal } from './IconPickerModal'
import { ConfirmDialog } from './Modal'
import { MoveNoteModal, NewFolderModal, NewNoteModal, RenameNoteModal } from './NoteDialogs'
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
    note.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    folderLabel(dirOf(note.path)).toLowerCase().includes(q)
  )
}

const rowClass =
  'flex h-11 w-full shrink-0 items-center gap-2.5 px-3 text-left text-sm hover:bg-zinc-900'

export function NotesShell({ config }: { config: RepoConfig }) {
  const notes = useNotes()
  const folders = useNoteFolders()
  const { state, sync } = useSyncContext()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const selected = useNote(selectedPath)
  const menu = useContextMenu()
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)
  const [propertiesPath, setPropertiesPath] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null)
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [movingPath, setMovingPath] = useState<string | null>(null)
  const [iconPath, setIconPath] = useState<string | null>(null)
  const tagSuggestions = useMemo(() => normalizeTags(notes?.flatMap((note) => note.tags) ?? []), [notes])
  const propertiesNote = notes?.find((note) => note.path === propertiesPath)
  const savedMode = useLiveQuery(() => getSetting('editor_mode'))
  const mode: EditorMode = savedMode === 'code' ? 'code' : 'rich'
  const savedFolder = useLiveQuery(() => getSetting('note_current_folder'), [], 'loading' as const)
  const currentFolder =
    savedFolder === 'loading'
      ? NOTES_ROOT
      : savedFolder
        ? normalizeNoteFolder(savedFolder)
        : NOTES_ROOT

  function setCurrentFolder(folder: string) {
    void setSetting('note_current_folder', normalizeNoteFolder(folder))
  }

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

  const searching = query.trim().length > 0

  const childFolders = useMemo(() => childFoldersOf(currentFolder, folders), [currentFolder, folders])

  const folderNotes = useMemo(() => {
    const list = (notes ?? []).filter((note) => dirOf(note.path) === currentFolder)
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, currentFolder])

  const searchNotes = useMemo(
    () => (searching ? (notes?.filter((note) => matches(note, query)) ?? []) : []),
    [notes, query, searching],
  )

  const breadcrumbs = useMemo(() => folderBreadcrumbs(currentFolder), [currentFolder])

  async function confirmDelete(note: Note) {
    setPendingDelete(null)
    await deleteNote(note.path)
    if (selectedPath === note.path) setSelectedPath(null)
  }

  async function handleDuplicate(path: string) {
    const copyPath = await duplicateNote(path)
    if (copyPath) setSelectedPath(copyPath)
  }

  function openNote(path: string) {
    setSelectedPath(path)
    setCurrentFolder(dirOf(path))
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
        onSelect: () => openExternal(url),
      },
      'separator',
      { label: 'Renomear', icon: PencilLine, onSelect: () => setRenamingPath(note.path) },
      { label: 'Alterar ícone', icon: Smile, onSelect: () => setIconPath(note.path) },
      { label: 'Mover para…', icon: FolderInput, onSelect: () => setMovingPath(note.path) },
      { label: 'Propriedades', icon: SlidersHorizontal, onSelect: () => setPropertiesPath(note.path) },
      { label: 'Duplicar', icon: CopyPlus, onSelect: () => handleDuplicate(note.path) },
      { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => setPendingDelete(note) },
    ]
  }

  function openNoteMenu(event: MouseEvent, note: Note) {
    menu.open(event, [
      { label: 'Abrir', icon: FileText, disabled: note.path === selectedPath, onSelect: () => openNote(note.path) },
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

  function openFolderMenu(event: MouseEvent, folder: string) {
    event.preventDefault()
    event.stopPropagation()
    menu.open(event, [
      { label: 'Abrir pasta', icon: Folder, onSelect: () => setCurrentFolder(folder) },
      { label: 'Nova nota nesta pasta', icon: Plus, onSelect: () => setCreatingInFolder(folder) },
      { label: 'Nova subpasta', icon: FolderPlus, onSelect: () => setCreatingFolder(folder) },
    ])
  }

  function openListMenu(event: MouseEvent) {
    menu.open(event, [
      { label: 'Nova nota', icon: Plus, onSelect: () => setCreatingInFolder(currentFolder === NOTES_ROOT ? DEFAULT_NOTE_FOLDER : currentFolder) },
      { label: 'Nova pasta', icon: FolderPlus, onSelect: () => setCreatingFolder(currentFolder) },
      {
        label: 'Sincronizar agora',
        icon: RefreshCw,
        disabled: state.status === 'syncing',
        onSelect: sync,
      },
    ])
  }

  function renderNoteRow(note: Note, showFolder: boolean) {
    const NoteIcon = resolveAppIcon(note.icon, DEFAULT_NOTE_ICON)
    return (
      <li key={note.path}>
        <button
          type="button"
          onClick={() => openNote(note.path)}
          onContextMenu={(e) => openNoteMenu(e, note)}
          className={`${rowClass} ${note.path === selectedPath ? 'bg-zinc-900' : ''}`}
        >
          <NoteIcon size={16} className="shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{fileNameOf(note.path)}</span>
            <span className="block truncate text-xs text-zinc-500" title={new Date(note.updatedAt).toLocaleString()}>
              {showFolder ? `${folderLabel(dirOf(note.path))} · ` : ''}
              {formatNoteDate(note.updatedAt)}
            </span>
          </span>
          {note.syncStatus !== 'synced' && (
            <span
              title={note.syncStatus}
              className={`size-2 shrink-0 rounded-full ${note.syncStatus === 'conflict' ? 'bg-amber-400' : 'bg-sky-400'}`}
            />
          )}
        </button>
      </li>
    )
  }

  const iconNote = notes?.find((note) => note.path === iconPath)

  const empty = searching
    ? searchNotes.length === 0
    : childFolders.length === 0 && folderNotes.length === 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
          <div className="flex items-center gap-1 border-b border-zinc-800 p-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-sky-500"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={() => setCreatingFolder(currentFolder)}
              title="Nova pasta"
              className="rounded-md p-1.5 hover:bg-zinc-800"
            >
              <FolderPlus size={18} />
            </button>
            <button
              onClick={() =>
                setCreatingInFolder(currentFolder === NOTES_ROOT ? DEFAULT_NOTE_FOLDER : currentFolder)
              }
              title="Nova nota"
              className="rounded-md p-1.5 hover:bg-zinc-800"
            >
              <Plus size={18} />
            </button>
          </div>

          {!searching && (
            <nav className="flex flex-wrap items-center gap-0.5 border-b border-zinc-800 px-2 py-2 text-xs">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1
                return (
                  <span key={crumb.path} className="flex items-center gap-0.5">
                    {index > 0 && <ChevronRight size={12} className="text-zinc-600" />}
                    <button
                      type="button"
                      disabled={last}
                      onClick={() => setCurrentFolder(crumb.path)}
                      className={`max-w-28 truncate rounded px-1.5 py-0.5 ${
                        last
                          ? 'font-medium text-zinc-200'
                          : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      {crumb.label}
                    </button>
                  </span>
                )
              })}
            </nav>
          )}

          <ul className="flex-1 overflow-y-auto py-1" onContextMenu={openListMenu}>
            {empty && (
              <li className="px-3 py-6 text-center text-xs text-zinc-600">
                {searching ? `Nada encontrado para “${query.trim()}”.` : 'Pasta vazia.'}
              </li>
            )}

            {searching
              ? searchNotes.map((note) => renderNoteRow(note, true))
              : (
                  <>
                    {childFolders.map((folder) => (
                      <li key={folder}>
                        <button
                          type="button"
                          onClick={() => setCurrentFolder(folder)}
                          onContextMenu={(e) => openFolderMenu(e, folder)}
                          className={rowClass}
                        >
                          <Folder size={16} className="shrink-0 text-sky-500/80" />
                          <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">
                            {childFolderName(currentFolder, folder)}
                          </span>
                          <ChevronRight size={14} className="shrink-0 text-zinc-600" />
                        </button>
                      </li>
                    ))}
                    {folderNotes.map((note) => renderNoteRow(note, false))}
                  </>
                )}
          </ul>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-zinc-600">{folderLabel(dirOf(selected.path))}/</span>
                  {fileNameOf(selected.path)}
                </span>
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
      {creatingInFolder && (
        <NewNoteModal
          tagSuggestions={tagSuggestions}
          folders={folders}
          initialFolder={creatingInFolder}
          onCreated={(path) => {
            setCreatingInFolder(null)
            openNote(path)
          }}
          onClose={() => setCreatingInFolder(null)}
        />
      )}
      {creatingFolder !== null && (
        <NewFolderModal
          parentFolder={creatingFolder}
          onCreated={(folder) => {
            setCreatingFolder(null)
            setCurrentFolder(folder)
            setCreatingInFolder(folder)
          }}
          onClose={() => setCreatingFolder(null)}
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
      {movingPath && (
        <MoveNoteModal
          path={movingPath}
          folders={folders}
          onMoved={(path) => {
            if (selectedPath === movingPath) setSelectedPath(path)
            setCurrentFolder(dirOf(path))
            setMovingPath(null)
          }}
          onClose={() => setMovingPath(null)}
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
      {iconNote && (
        <IconPickerModal
          value={iconNote.icon}
          fallback="note"
          onSelect={(icon: AppIconId | null) => void setNoteIcon(iconNote.path, icon)}
          onClose={() => setIconPath(null)}
        />
      )}
    </div>
  )
}
