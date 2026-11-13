import { useLiveQuery } from 'dexie-react-hooks'
import { parseFrontmatter, stripFrontmatter, unquote } from '../lib/frontmatter'
import { datedBasePath } from '../lib/paths'
import { db, type Memory, type MemoryList } from './db'

type MemoryMeta = Pick<Memory, 'id' | 'body' | 'pinned' | 'listId' | 'createdAt' | 'editedAt'>

export const BOARD_PATH = 'memories/board.json'

export const DEFAULT_LISTS: MemoryList[] = [{ id: 'inbox', name: 'Entrada' }]

function parseDate(raw: string | undefined): number | null {
  const time = raw ? Date.parse(unquote(raw)) : NaN
  return Number.isNaN(time) ? null : time
}

export function parseMemory(path: string, content: string): MemoryMeta {
  const fields = parseFrontmatter(content)
  return {
    id: fields.id ? unquote(fields.id) : path,
    body: stripFrontmatter(content).trim(),
    pinned: fields.pinned === 'true',
    listId: fields.list ? unquote(fields.list) : null,
    createdAt: parseDate(fields.created_at) ?? 0,
    editedAt: parseDate(fields.edited_at),
  }
}

function buildMemoryContent(meta: MemoryMeta): string {
  const lines = ['---', `id: "${meta.id}"`, `created_at: "${new Date(meta.createdAt).toISOString()}"`]
  if (meta.editedAt) lines.push(`edited_at: "${new Date(meta.editedAt).toISOString()}"`)
  if (meta.listId) lines.push(`list: "${meta.listId}"`)
  lines.push(`pinned: ${meta.pinned}`, '---', '', meta.body.trim(), '')
  return lines.join('\n')
}

export function useMemories(): Memory[] | undefined {
  return useLiveQuery(() =>
    db.memories
      .orderBy('createdAt')
      .filter((memory) => memory.syncStatus !== 'deleted')
      .toArray(),
  )
}

export async function addMemory(body: string, listId: string | null): Promise<void> {
  const now = new Date()
  const meta: MemoryMeta = { id: crypto.randomUUID(), body, pinned: false, listId, createdAt: now.getTime(), editedAt: null }
  await db.memories.add({
    path: `${datedBasePath('memories', now)}.md`,
    content: buildMemoryContent(meta),
    sha: null,
    updatedAt: now.getTime(),
    syncStatus: 'dirty',
    ...meta,
  })
}

async function updateMemory(path: string, change: (memory: MemoryMeta) => MemoryMeta): Promise<void> {
  await db.transaction('rw', db.memories, async () => {
    const memory = await db.memories.get(path)
    if (!memory) return
    const meta = change(memory)
    await db.memories.update(path, {
      ...meta,
      content: buildMemoryContent(meta),
      updatedAt: Date.now(),
      syncStatus: 'dirty',
    })
  })
}

export function editMemory(path: string, body: string): Promise<void> {
  return updateMemory(path, (memory) => ({ ...memory, body, editedAt: Date.now() }))
}

export function setMemoryPinned(path: string, pinned: boolean): Promise<void> {
  return updateMemory(path, (memory) => ({ ...memory, pinned }))
}

export function moveMemory(path: string, listId: string): Promise<void> {
  return updateMemory(path, (memory) => ({ ...memory, listId }))
}

export async function deleteMemory(path: string): Promise<void> {
  const memory = await db.memories.get(path)
  if (!memory) return
  if (memory.sha === null) {
    await db.memories.delete(path)
  } else {
    await db.memories.update(path, { syncStatus: 'deleted', updatedAt: Date.now() })
  }
}

// ---- board lists -----------------------------------------------------------

export function parseBoard(_path: string, content: string): { lists: MemoryList[] } {
  try {
    const file = JSON.parse(content) as { lists?: unknown }
    const lists = Array.isArray(file.lists)
      ? file.lists.filter((list): list is MemoryList => typeof list?.id === 'string' && typeof list?.name === 'string')
      : []
    return { lists: lists.length ? lists : DEFAULT_LISTS }
  } catch {
    return { lists: DEFAULT_LISTS }
  }
}

function buildBoardContent(lists: MemoryList[]): string {
  return `${JSON.stringify({ lists }, null, 2)}\n`
}

export function useMemoryLists(): MemoryList[] {
  return useLiveQuery(async () => {
    const board = await db.memoryBoard.get(BOARD_PATH)
    return board && board.syncStatus !== 'deleted' ? board.lists : DEFAULT_LISTS
  }, [], DEFAULT_LISTS)
}

/** The board file is only created on the first change, so untouched boards don't add a file to the repo. */
async function updateLists(change: (lists: MemoryList[]) => MemoryList[]): Promise<void> {
  await db.transaction('rw', db.memoryBoard, async () => {
    const board = await db.memoryBoard.get(BOARD_PATH)
    const lists = change(board?.lists ?? DEFAULT_LISTS)
    await db.memoryBoard.put({
      path: BOARD_PATH,
      content: buildBoardContent(lists),
      sha: board?.sha ?? null,
      updatedAt: Date.now(),
      syncStatus: 'dirty',
      lists,
    })
  })
}

export async function addList(name: string): Promise<string> {
  const id = crypto.randomUUID().slice(0, 8)
  await updateLists((lists) => [...lists, { id, name: name.trim() }])
  return id
}

export function renameList(id: string, name: string): Promise<void> {
  return updateLists((lists) => lists.map((list) => (list.id === id ? { ...list, name: name.trim() } : list)))
}

// Cards keep pointing at the removed id and simply show up in the first list from then on.
export function deleteList(id: string): Promise<void> {
  return updateLists((lists) => (lists.length > 1 ? lists.filter((list) => list.id !== id) : lists))
}

export function moveList(id: string, delta: -1 | 1): Promise<void> {
  return updateLists((lists) => {
    const next = [...lists]
    const from = next.findIndex((list) => list.id === id)
    const to = from + delta
    if (from === -1 || to < 0 || to >= next.length) return lists
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
  })
}
