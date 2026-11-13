import Dexie, { type EntityTable } from 'dexie'
import type { CellValue, Field, ViewConfig } from './databaseTypes'

export type SyncStatus = 'synced' | 'dirty' | 'conflict' | 'deleted'

/** Any text file mirrored from the repository. */
export interface TextFile {
  path: string
  content: string
  sha: string | null
  updatedAt: number
  syncStatus: SyncStatus
}

export interface Note extends TextFile {
  title: string
  tags: string[]
}

export interface Memory extends TextFile {
  id: string
  body: string
  pinned: boolean
  /** Board list the card sits in; null or an unknown id shows it in the first list. */
  listId: string | null
  createdAt: number
  editedAt: number | null
}

export interface MemoryList {
  id: string
  name: string
}

/** `memories/board.json`: the board's lists, in display order. */
export interface MemoryBoard extends TextFile {
  lists: MemoryList[]
}

/** Metadata sidecar (`.json`) describing one gallery image. */
export interface GalleryItem extends TextFile {
  id: string
  imagePath: string
  categories: string[]
  createdAt: number
  width: number
  height: number
}

/** `<dir>schema.json`: the database's fields and saved view. */
export interface DatabaseSchema extends TextFile {
  id: string
  /** Folder of the database, e.g. `databases/tarefas-1a2b3c4d/`. */
  dir: string
  name: string
  fields: Field[]
  view: ViewConfig
  createdAt: number
}

/** `<dir>rows/<id>.json`: one record of a database. */
export interface DatabaseRow extends TextFile {
  id: string
  dir: string
  values: Record<string, CellValue>
  createdAt: number
}

/** Binary file tracked for sync; its bytes live in `blobs`. */
export interface Asset {
  path: string
  sha: string | null
  syncStatus: 'synced' | 'dirty' | 'deleted'
}

/** Kept apart from `assets` so listing assets never loads image bytes; filled lazily on first display. */
export interface StoredBlob {
  path: string
  blob: Blob
}

export type SettingKey =
  | 'github_token'
  | 'repo_owner'
  | 'repo_name'
  | 'branch'
  | 'last_tree_sha'
  | 'editor_mode'
  | 'section'

export interface Setting {
  key: SettingKey
  value: string
}

export const db = new Dexie('NotesAppDB') as Dexie & {
  notes: EntityTable<Note, 'path'>
  memories: EntityTable<Memory, 'path'>
  memoryBoard: EntityTable<MemoryBoard, 'path'>
  gallery: EntityTable<GalleryItem, 'path'>
  databases: EntityTable<DatabaseSchema, 'path'>
  databaseRows: EntityTable<DatabaseRow, 'path'>
  assets: EntityTable<Asset, 'path'>
  blobs: EntityTable<StoredBlob, 'path'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  notes: 'path, title, *tags, updatedAt, syncStatus',
  assets: 'path, syncStatus',
  settings: 'key',
})

db.version(2).stores({
  memories: 'path, createdAt, syncStatus',
  gallery: 'path, createdAt, *categories, syncStatus',
  blobs: 'path',
})

db.version(3).stores({
  databases: 'path, createdAt, syncStatus',
  databaseRows: 'path, dir, createdAt, syncStatus',
})

db.version(4).stores({
  memoryBoard: 'path, syncStatus',
})
