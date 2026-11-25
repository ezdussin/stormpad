import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { newNoteContent, parseNoteMeta, setFrontmatterField } from '../lib/frontmatter'
import {
  dirOf,
  fileNameOf,
  folderLabel,
  joinNoteFolder,
  normalizeFileName,
  normalizeNoteFolder,
  NOTES_ROOT,
  validateFolderName,
} from '../lib/paths'
import { normalizeTags } from '../lib/tags'
import { db, type Note } from './db'
import { getSetting, setSetting } from './settings'

export function useNotes(): Note[] | undefined {
  return useLiveQuery(() =>
    db.notes
      .orderBy('updatedAt')
      .reverse()
      .filter((note) => note.syncStatus !== 'deleted')
      .toArray(),
  )
}

export function useNote(path: string | null): Note | undefined {
  return useLiveQuery(() => (path ? db.notes.get(path) : undefined), [path])
}

export const DEFAULT_NOTE_FOLDER = 'notes/inbox/'

const NAME_TAKEN_ERROR = 'Já existe uma nota com esse nome nesta pasta.'

/**
 * A path pending deletion can be reused: keeping its sha turns the remote delete into an update.
 * Must run inside a transaction on `db.notes`.
 */
async function claimPath(path: string): Promise<string | null> {
  const existing = await db.notes.get(path)
  if (existing && existing.syncStatus !== 'deleted') throw new Error(NAME_TAKEN_ERROR)
  return existing?.sha ?? null
}

export async function createNote({
  name,
  title,
  tags,
  folder = DEFAULT_NOTE_FOLDER,
}: {
  name: string
  title: string
  tags: string[]
  folder?: string
}): Promise<string> {
  const now = new Date()
  const path = `${normalizeNoteFolder(folder)}${normalizeFileName(name)}.md`
  const content = newNoteContent(crypto.randomUUID(), now, { title, tags: normalizeTags(tags) })
  await db.transaction('rw', db.notes, async () => {
    const sha = await claimPath(path)
    await db.notes.put({
      path,
      content,
      sha,
      updatedAt: now.getTime(),
      syncStatus: 'dirty',
      ...parseNoteMeta(path, content),
    })
  })
  await rememberNoteFolder(dirOf(path))
  return path
}

export async function renameNote(path: string, name: string): Promise<string> {
  const newPath = `${dirOf(path)}${normalizeFileName(name)}.md`
  if (newPath === path) return path

  await db.transaction('rw', db.notes, async () => {
    const note = await db.notes.get(path)
    if (!note) throw new Error('Nota não encontrada.')
    const sha = await claimPath(newPath)
    const now = Date.now()
    await db.notes.put({
      ...note,
      path: newPath,
      sha,
      updatedAt: now,
      syncStatus: 'dirty',
      ...parseNoteMeta(newPath, note.content),
    })
    if (note.sha === null) await db.notes.delete(path)
    else await db.notes.update(path, { syncStatus: 'deleted', updatedAt: now })
  })
  return newPath
}

export async function moveNote(path: string, folder: string): Promise<string> {
  const targetFolder = normalizeNoteFolder(folder)
  const newPath = `${targetFolder}${normalizeFileName(fileNameOf(path))}.md`
  if (newPath === path) return path

  await db.transaction('rw', db.notes, async () => {
    const note = await db.notes.get(path)
    if (!note) throw new Error('Nota não encontrada.')
    const sha = await claimPath(newPath)
    const now = Date.now()
    await db.notes.put({
      ...note,
      path: newPath,
      sha,
      updatedAt: now,
      syncStatus: 'dirty',
      ...parseNoteMeta(newPath, note.content),
    })
    if (note.sha === null) await db.notes.delete(path)
    else await db.notes.update(path, { syncStatus: 'deleted', updatedAt: now })
  })
  await rememberNoteFolder(targetFolder)
  return newPath
}

export async function duplicateNote(path: string): Promise<string | null> {
  const note = await db.notes.get(path)
  if (!note) return null

  const base = path.replace(/\.md$/, '')
  let copyPath = `${base}-copia.md`
  for (let n = 2; await db.notes.get(copyPath); n++) copyPath = `${base}-copia-${n}.md`

  const now = new Date()
  let content = setFrontmatterField(note.content, 'id', `"${crypto.randomUUID()}"`)
  content = setFrontmatterField(content, 'created_at', `"${now.toISOString()}"`)
  content = setFrontmatterField(content, 'updated_at', `"${now.toISOString()}"`)

  await db.notes.add({
    path: copyPath,
    content,
    sha: null,
    updatedAt: now.getTime(),
    syncStatus: 'dirty',
    ...parseNoteMeta(copyPath, content),
  })
  return copyPath
}

// A late autosave must not revive a note that was deleted or renamed away in the meantime.
export async function updateNoteContent(path: string, content: string): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    const note = await db.notes.get(path)
    if (!note || note.syncStatus === 'deleted') return
    await db.notes.update(path, {
      content,
      updatedAt: Date.now(),
      syncStatus: 'dirty',
      ...parseNoteMeta(path, content),
    })
  })
}

export async function deleteNote(path: string): Promise<void> {
  const note = await db.notes.get(path)
  if (!note) return
  if (note.sha === null) {
    await db.notes.delete(path)
  } else {
    await db.notes.update(path, { syncStatus: 'deleted', updatedAt: Date.now() })
  }
}

// ---- folders (path prefixes; empty ones kept in settings) --------------------

async function loadRememberedFolders(): Promise<string[]> {
  const raw = await getSetting('note_folders')
  if (!raw) return [DEFAULT_NOTE_FOLDER]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [DEFAULT_NOTE_FOLDER]
    const folders = parsed
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeNoteFolder)
    return folders.length ? folders : [DEFAULT_NOTE_FOLDER]
  } catch {
    return [DEFAULT_NOTE_FOLDER]
  }
}

export async function rememberNoteFolder(folder: string): Promise<void> {
  const normalized = normalizeNoteFolder(folder)
  const current = await loadRememberedFolders()
  if (current.includes(normalized)) return
  await setSetting('note_folders', JSON.stringify([...current, normalized].sort()))
}

export async function createNoteFolder(parent: string, name: string): Promise<string> {
  const invalid = validateFolderName(name)
  if (invalid) throw new Error(invalid)
  const folder = joinNoteFolder(parent || NOTES_ROOT, name)
  await rememberNoteFolder(folder)
  return folder
}

/** Folders from note paths + remembered empty folders, sorted. */
export function foldersFromNotes(notes: Note[], remembered: string[] = []): string[] {
  const set = new Set<string>([DEFAULT_NOTE_FOLDER, ...remembered.map(normalizeNoteFolder)])
  for (const note of notes) {
    let folder = dirOf(note.path)
    while (folder.startsWith(NOTES_ROOT) && folder.length > NOTES_ROOT.length) {
      set.add(folder)
      const parent = dirOf(folder.slice(0, -1))
      if (!parent || parent === folder) break
      folder = parent
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function useNoteFolders(): string[] {
  const notes = useNotes()
  const remembered = useLiveQuery(loadRememberedFolders, [], [DEFAULT_NOTE_FOLDER])
  return useMemo(() => foldersFromNotes(notes ?? [], remembered), [notes, remembered])
}

function parseExpandedFolders(raw: string | undefined): Set<string> {
  if (!raw) return new Set([DEFAULT_NOTE_FOLDER])
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set([DEFAULT_NOTE_FOLDER])
    return new Set(parsed.filter((item): item is string => typeof item === 'string').map(normalizeNoteFolder))
  } catch {
    return new Set([DEFAULT_NOTE_FOLDER])
  }
}

export function useExpandedNoteFolders(): {
  expanded: Set<string>
  toggle: (folder: string) => void
} {
  const raw = useLiveQuery(() => getSetting('note_folders_expanded'), [])
  const expanded = useMemo(() => parseExpandedFolders(raw), [raw])

  function toggle(folder: string) {
    const next = new Set(expanded)
    const normalized = normalizeNoteFolder(folder)
    if (next.has(normalized)) next.delete(normalized)
    else next.add(normalized)
    void setSetting('note_folders_expanded', JSON.stringify([...next].sort()))
  }

  return { expanded, toggle }
}

export { folderLabel }
