import { Download, FolderTree, ImagePlus, Images, Info, Maximize2, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import type { GalleryItem } from '../../db/db'
import { deleteGalleryItem, useGalleryItems } from '../../db/gallery'
import { copyText } from '../../lib/clipboard'
import { useSyncContext } from '../../sync/SyncContext'
import { ConfirmDialog } from '../Modal'
import { useContextMenu } from '../useContextMenu'
import { downloadBlob } from './download'
import { GalleryThumbnail } from './GalleryThumbnail'
import { ImageViewer } from './ImageViewer'
import { UploadModal } from './UploadModal'

const UNCATEGORIZED = Symbol('uncategorized')
type Filter = string | typeof UNCATEGORIZED | null

function imageFiles(files: FileList | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => file.type.startsWith('image/'))
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
}

function hasCategory(item: GalleryItem, category: string): boolean {
  const key = category.toLowerCase()
  return item.categories.some((c) => c.toLowerCase() === key)
}

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
    active
      ? 'border-sky-500 bg-sky-500/15 text-sky-200'
      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
  }`

export function GalleryView() {
  const items = useGalleryItems()
  const { service } = useSyncContext()
  const menu = useContextMenu()
  const fileInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>(null)
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null)
  const [viewerPath, setViewerPath] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null)
  const [dragging, setDragging] = useState(false)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items ?? []) {
      for (const category of item.categories) {
        const existing = [...counts.keys()].find((c) => c.toLowerCase() === category.toLowerCase()) ?? category
        counts.set(existing, (counts.get(existing) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])
  const categoryNames = categories.map(([name]) => name)
  const uncategorizedCount = items?.filter((item) => item.categories.length === 0).length ?? 0

  const activeFilter: Filter =
    filter === UNCATEGORIZED
      ? uncategorizedCount > 0
        ? UNCATEGORIZED
        : null
      : filter && categoryNames.some((name) => name.toLowerCase() === filter.toLowerCase())
        ? filter
        : null

  const visible = useMemo(() => {
    if (!items) return []
    if (activeFilter === null) return items
    if (activeFilter === UNCATEGORIZED) return items.filter((item) => item.categories.length === 0)
    return items.filter((item) => hasCategory(item, activeFilter))
  }, [items, activeFilter])

  const viewerIndex = visible.findIndex((item) => item.path === viewerPath)
  const viewerItem = viewerIndex === -1 ? null : visible[viewerIndex]

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isTyping(event.target)) return
      const files = imageFiles(event.clipboardData?.files)
      if (files.length) setUploadFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function handleDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const files = imageFiles(event.dataTransfer.files)
    if (files.length) setUploadFiles(files)
  }

  async function download(item: GalleryItem) {
    const blob = await service.loadAsset(item.imagePath)
    if (blob) downloadBlob(blob, item.imagePath.split('/').pop() ?? 'imagem')
  }

  function openMenu(event: MouseEvent, item: GalleryItem) {
    menu.open(event, [
      { label: 'Abrir', icon: Maximize2, onSelect: () => setViewerPath(item.path) },
      { label: 'Baixar', icon: Download, onSelect: () => download(item) },
      { label: 'Copiar caminho', icon: FolderTree, onSelect: () => copyText(item.imagePath) },
      'separator',
      { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => setPendingDelete(item) },
    ])
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-semibold">Galeria</h1>
        <span className="text-xs text-zinc-500">{items?.length ?? 0}</span>
        <button
          onClick={() => fileInput.current?.click()}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500"
        >
          <ImagePlus size={16} /> Adicionar
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = imageFiles(e.target.files)
            if (files.length) setUploadFiles(files)
            e.target.value = ''
          }}
        />
      </header>

      <div className="flex items-start gap-2 border-b border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-400">
        <Info size={14} className="mt-0.5 shrink-0 text-sky-400" />
        <p>
          Imagens são reduzidas para no máximo 2560px e comprimidas em WebP (ou JPEG se o navegador não
          suportar). GIF e SVG ficam no original. Só arquivos de imagem são aceitos.
        </p>
      </div>

      {(categories.length > 0 || uncategorizedCount > 0) && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-4 py-2">
          <button onClick={() => setFilter(null)} className={chipClass(activeFilter === null)}>
            Todas <span className="opacity-60">{items?.length ?? 0}</span>
          </button>
          {categories.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setFilter(activeFilter === name ? null : name)}
              className={chipClass(typeof activeFilter === 'string' && activeFilter.toLowerCase() === name.toLowerCase())}
            >
              {name} <span className="opacity-60">{count}</span>
            </button>
          ))}
          {uncategorizedCount > 0 && categories.length > 0 && (
            <button
              onClick={() => setFilter(activeFilter === UNCATEGORIZED ? null : UNCATEGORIZED)}
              className={chipClass(activeFilter === UNCATEGORIZED)}
            >
              Sem categoria <span className="opacity-60">{uncategorizedCount}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {items && items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500">
            <Images size={32} className="text-zinc-700" />
            Nenhuma imagem ainda.
            <span className="text-xs text-zinc-600">Clique em Adicionar, arraste imagens para cá ou cole com Ctrl+V.</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            {visible.map((item) => (
              <GalleryThumbnail
                key={item.path}
                item={item}
                onOpen={() => setViewerPath(item.path)}
                onMenu={(event) => openMenu(event, item)}
              />
            ))}
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-500/10 text-sky-200">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Upload size={18} /> Solte as imagens para adicionar
          </span>
        </div>
      )}

      {menu.element}
      {uploadFiles && (
        <UploadModal files={uploadFiles} suggestions={categoryNames} onClose={() => setUploadFiles(null)} />
      )}
      {viewerItem && (
        <ImageViewer
          item={viewerItem}
          suggestions={categoryNames}
          onPrevious={viewerIndex > 0 ? () => setViewerPath(visible[viewerIndex - 1].path) : undefined}
          onNext={viewerIndex < visible.length - 1 ? () => setViewerPath(visible[viewerIndex + 1].path) : undefined}
          onDelete={() => setPendingDelete(viewerItem)}
          onClose={() => setViewerPath(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Excluir imagem"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir esta imagem?{' '}
              {pendingDelete.sha === null
                ? 'Ela ainda não foi enviada ao GitHub e será perdida.'
                : 'Ela também será removida do GitHub no próximo sync.'}
            </p>
          }
          onConfirm={() => {
            void deleteGalleryItem(pendingDelete.path)
            if (viewerPath === pendingDelete.path) setViewerPath(null)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
