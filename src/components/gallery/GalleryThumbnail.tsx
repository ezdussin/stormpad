import { ImageOff, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { GalleryItem } from '../../db/db'
import { BlobImage } from './BlobImage'
import { useAssetBlob } from './useAssetBlob'

interface GalleryThumbnailProps {
  item: GalleryItem
  onOpen: () => void
  onMenu: (event: MouseEvent) => void
}

export function GalleryThumbnail({ item, onOpen, onMenu }: GalleryThumbnailProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const { blob, failed } = useAssetBlob(item.imagePath, visible)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      ref={ref}
      onClick={onOpen}
      onContextMenu={onMenu}
      className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {blob ? (
        <BlobImage
          blob={blob}
          alt={item.categories.join(', ')}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-zinc-700">
          {failed ? <ImageOff size={22} /> : visible && <Loader2 size={20} className="animate-spin" />}
        </span>
      )}

      {item.categories.length > 0 && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
          {item.categories.map((category) => (
            <span key={category} className="rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-zinc-200">
              {category}
            </span>
          ))}
        </span>
      )}

      {item.syncStatus !== 'synced' && (
        <span title="Ainda não enviada" className="absolute top-2 right-2 size-2 rounded-full bg-sky-400 ring-2 ring-black/40" />
      )}
    </button>
  )
}
