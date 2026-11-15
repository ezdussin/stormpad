import { Capacitor, registerPlugin } from '@capacitor/core'
import { BOARD_PATH, DEFAULT_LISTS } from '../db/memories'
import { db, type Memory, type MemoryList } from '../db/db'

export const APP_GROUP_ID = 'group.com.ezdussin.stormpad'
export const MEMORIES_SNAPSHOT_KEY = 'memoriesSnapshot'
export const BODY_MAX_CHARS = 280
export const SNAPSHOT_LIMIT = 20

export interface MemoryWidgetItem {
  id: string
  path: string
  body: string
  pinned: boolean
  listId: string | null
  listName: string
  createdAt: number
}

export interface MemoriesWidgetSnapshot {
  updatedAt: number
  items: MemoryWidgetItem[]
}

interface WidgetBridgePlugin {
  setMemories(options: { json: string }): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge', {
  web: () => ({
    setMemories: async () => {},
  }),
})

function truncateBody(body: string): string {
  const trimmed = body.trim()
  if (trimmed.length <= BODY_MAX_CHARS) return trimmed
  return `${trimmed.slice(0, BODY_MAX_CHARS - 1).trimEnd()}…`
}

function listNameFor(listId: string | null, lists: MemoryList[]): string {
  if (!listId) return lists[0]?.name ?? 'Entrada'
  return lists.find((list) => list.id === listId)?.name ?? lists[0]?.name ?? 'Entrada'
}

export function buildMemoriesSnapshot(memories: Memory[], lists: MemoryList[]): MemoriesWidgetSnapshot {
  const items = [...memories]
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
    .slice(0, SNAPSHOT_LIMIT)
    .map((memory) => ({
      id: memory.id,
      path: memory.path,
      body: truncateBody(memory.body),
      pinned: memory.pinned,
      listId: memory.listId,
      listName: listNameFor(memory.listId, lists),
      createdAt: memory.createdAt,
    }))

  return { updatedAt: Date.now(), items }
}

/** Push the current IndexedDB memories into the iOS App Group for WidgetKit. No-op outside Capacitor iOS. */
export async function refreshMemoriesWidget(): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return

  const [memories, board] = await Promise.all([
    db.memories.filter((memory) => memory.syncStatus !== 'deleted').toArray(),
    db.memoryBoard.get(BOARD_PATH),
  ])
  const lists = board && board.syncStatus !== 'deleted' ? board.lists : DEFAULT_LISTS
  const snapshot = buildMemoriesSnapshot(memories, lists)

  try {
    await WidgetBridge.setMemories({ json: JSON.stringify(snapshot) })
  } catch {
    // Widget extension may not be installed yet during early Cap sync builds.
  }
}
