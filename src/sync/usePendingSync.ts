import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export interface PendingSyncCounts {
  dirty: number
  deleted: number
  conflicts: number
  total: number
}

const EMPTY: PendingSyncCounts = { dirty: 0, deleted: 0, conflicts: 0, total: 0 }

/** How many local records still need to reach GitHub (or resolve a conflict). */
export function usePendingSync(): PendingSyncCounts {
  return (
    useLiveQuery(async () => {
      const [notes, memories, board, gallery, assets, databases, rows] = await Promise.all([
        db.notes.where('syncStatus').anyOf('dirty', 'deleted', 'conflict').toArray(),
        db.memories.where('syncStatus').anyOf('dirty', 'deleted', 'conflict').toArray(),
        db.memoryBoard.where('syncStatus').anyOf('dirty', 'deleted', 'conflict').toArray(),
        db.gallery.where('syncStatus').anyOf('dirty', 'deleted', 'conflict').toArray(),
        db.assets.where('syncStatus').anyOf('dirty', 'deleted').toArray(),
        db.databases.where('syncStatus').anyOf('dirty', 'deleted').toArray(),
        db.databaseRows.where('syncStatus').anyOf('dirty', 'deleted').toArray(),
      ])

      const pending = [...notes, ...memories, ...board, ...gallery, ...assets, ...databases, ...rows]
      let dirty = 0
      let deleted = 0
      let conflicts = 0
      for (const item of pending) {
        if (item.syncStatus === 'dirty') dirty++
        else if (item.syncStatus === 'deleted') deleted++
        else if (item.syncStatus === 'conflict') conflicts++
      }

      return { dirty, deleted, conflicts, total: dirty + deleted + conflicts }
    }, [], EMPTY) ?? EMPTY
  )
}
