import { useLiveQuery } from 'dexie-react-hooks'
import { prepareImage } from '../lib/image'
import { normalizeTags } from '../lib/tags'
import { datedBasePath, dirOf } from '../lib/paths'
import { db, type GalleryItem } from './db'

type GalleryMeta = Pick<GalleryItem, 'id' | 'imagePath' | 'categories' | 'createdAt' | 'width' | 'height'>

interface GalleryFile {
  id?: string
  image?: string
  categories?: unknown
  created_at?: string
  width?: number
  height?: number
}

export function parseGalleryItem(path: string, content: string): GalleryMeta {
  let file: GalleryFile = {}
  try {
    file = JSON.parse(content) as GalleryFile
  } catch {
    // Malformed metadata still shows up in the gallery, just without an image.
  }
  const createdAt = file.created_at ? Date.parse(file.created_at) : NaN
  return {
    id: file.id ?? path,
    imagePath: file.image ? dirOf(path) + file.image : '',
    categories: Array.isArray(file.categories) ? normalizeTags(file.categories.map(String)) : [],
    createdAt: Number.isNaN(createdAt) ? 0 : createdAt,
    width: file.width ?? 0,
    height: file.height ?? 0,
  }
}

function buildGalleryContent(meta: GalleryMeta): string {
  const file: GalleryFile = {
    id: meta.id,
    image: meta.imagePath.slice(meta.imagePath.lastIndexOf('/') + 1),
    categories: meta.categories,
    created_at: new Date(meta.createdAt).toISOString(),
    width: meta.width,
    height: meta.height,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export function useGalleryItems(): GalleryItem[] | undefined {
  return useLiveQuery(() =>
    db.gallery
      .orderBy('createdAt')
      .reverse()
      .filter((item) => item.syncStatus !== 'deleted')
      .toArray(),
  )
}

export async function addGalleryImage(file: File, categories: string[]): Promise<void> {
  const image = await prepareImage(file)
  const now = new Date()
  const base = datedBasePath('gallery', now)
  const meta: GalleryMeta = {
    id: crypto.randomUUID(),
    imagePath: `${base}.${image.extension}`,
    categories: normalizeTags(categories),
    createdAt: now.getTime(),
    width: image.width,
    height: image.height,
  }
  await db.transaction('rw', [db.gallery, db.assets, db.blobs], async () => {
    await db.blobs.put({ path: meta.imagePath, blob: image.blob })
    await db.assets.put({ path: meta.imagePath, sha: null, syncStatus: 'dirty' })
    await db.gallery.add({
      path: `${base}.json`,
      content: buildGalleryContent(meta),
      sha: null,
      updatedAt: now.getTime(),
      syncStatus: 'dirty',
      ...meta,
    })
  })
}

export async function setGalleryCategories(path: string, categories: string[]): Promise<void> {
  await db.transaction('rw', db.gallery, async () => {
    const item = await db.gallery.get(path)
    if (!item) return
    const meta = { ...item, categories: normalizeTags(categories) }
    await db.gallery.update(path, {
      categories: meta.categories,
      content: buildGalleryContent(meta),
      updatedAt: Date.now(),
      syncStatus: 'dirty',
    })
  })
}

export async function deleteGalleryItem(path: string): Promise<void> {
  await db.transaction('rw', [db.gallery, db.assets, db.blobs], async () => {
    const item = await db.gallery.get(path)
    if (!item) return
    if (item.sha === null) await db.gallery.delete(path)
    else await db.gallery.update(path, { syncStatus: 'deleted', updatedAt: Date.now() })

    if (!item.imagePath) return
    await db.blobs.delete(item.imagePath)
    const asset = await db.assets.get(item.imagePath)
    if (!asset) return
    if (asset.sha === null) await db.assets.delete(item.imagePath)
    else await db.assets.update(item.imagePath, { syncStatus: 'deleted' })
  })
}
