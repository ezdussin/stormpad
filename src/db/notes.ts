import { useLiveQuery } from 'dexie-react-hooks'
import { newNoteContent, parseNoteMeta, setFrontmatterField } from '../lib/frontmatter'
import { dirOf, normalizeFileName } from '../lib/paths'
import { normalizeTags } from '../lib/tags'
import { db, type Note } from './db'

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

export async function createNote({ name, title, tags }: { name: string; title: string; tags: string[] }): Promise<string> {
  const now = new Date()
  const path = `${DEFAULT_NOTE_FOLDER}${normalizeFileName(name)}.md`
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
