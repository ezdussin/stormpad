import { ChevronLeft, ChevronRight, Download, ImageOff, Loader2, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import type { GalleryItem } from '../../db/db'
import { setGalleryCategories } from '../../db/gallery'
import { Modal } from '../Modal'
import { BlobImage } from './BlobImage'
import { TagInput } from '../TagInput'
import { downloadBlob } from './download'
import { useAssetBlob } from './useAssetBlob'

interface ImageViewerProps {
  item: GalleryItem
  suggestions: string[]
  onPrevious?: () => void
  onNext?: () => void
  onDelete: () => void
  onClose: () => void
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
}

const navButton =
  'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-zinc-200 opacity-70 hover:bg-black/70 hover:opacity-100'

export function ImageViewer({ item, suggestions, onPrevious, onNext, onDelete, onClose }: ImageViewerProps) {
  const { blob, failed } = useAssetBlob(item.imagePath, true)
  const fileName = item.imagePath.split('/').pop() ?? 'imagem'

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return
      if (event.key === 'ArrowLeft') onPrevious?.()
      if (event.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onPrevious, onNext])

  return (
    <Modal
      title={new Date(item.createdAt).toLocaleString()}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button
            onClick={onDelete}
            className="mr-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-800"
          >
            <Trash2 size={15} /> Excluir
          </button>
          <button
            onClick={() => blob && downloadBlob(blob, fileName)}
            disabled={!blob}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <Download size={15} /> Baixar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative flex h-[60vh] items-center justify-center overflow-hidden rounded-md bg-black/40">
          {blob ? (
            <BlobImage blob={blob} alt={item.categories.join(', ')} className="max-h-full max-w-full object-contain" />
          ) : failed ? (
            <span className="flex flex-col items-center gap-2 text-zinc-500">
              <ImageOff size={28} /> Não foi possível carregar a imagem.
            </span>
          ) : (
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          )}
          {onPrevious && (
            <button onClick={onPrevious} title="Anterior (←)" className={`${navButton} left-2`}>
              <ChevronLeft size={20} />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} title="Próxima (→)" className={`${navButton} right-2`}>
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-zinc-400">Categorias</span>
          <TagInput placeholder="Adicionar categoria…"
            key={item.path}
            value={item.categories}
            onChange={(categories) => void setGalleryCategories(item.path, categories)}
            suggestions={suggestions}
          />
        </div>

        {item.width > 0 && (
          <p className="text-xs text-zinc-500">
            {item.width} × {item.height}px · {fileName}
          </p>
        )}
      </div>
    </Modal>
  )
}
