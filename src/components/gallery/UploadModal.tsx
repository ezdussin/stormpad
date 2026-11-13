import { useState } from 'react'
import { addGalleryImage } from '../../db/gallery'
import { Modal } from '../Modal'
import { BlobImage } from './BlobImage'
import { TagInput } from '../TagInput'

const MAX_PREVIEWS = 8

interface UploadModalProps {
  files: File[]
  suggestions: string[]
  onClose: () => void
}

export function UploadModal({ files, suggestions, onClose }: UploadModalProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const processing = progress !== null && progress < files.length
  const finished = progress === files.length

  async function upload() {
    const failures: string[] = []
    for (const [i, file] of files.entries()) {
      setProgress(i)
      try {
        await addGalleryImage(file, categories)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `${file.name}: ${String(error)}`)
      }
    }
    setProgress(files.length)
    setErrors(failures)
    if (failures.length === 0) onClose()
  }

  return (
    <Modal
      title={files.length === 1 ? 'Adicionar imagem' : `Adicionar ${files.length} imagens`}
      onClose={processing ? () => {} : onClose}
      size="lg"
      footer={
        finished ? (
          <button onClick={onClose} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500">
            Fechar
          </button>
        ) : (
          <>
            <button
              onClick={onClose}
              disabled={processing}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={() => void upload()}
              disabled={processing}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-60"
            >
              {processing ? `Processando ${(progress ?? 0) + 1}/${files.length}…` : 'Adicionar'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {files.slice(0, MAX_PREVIEWS).map((file, i) => (
            <BlobImage key={i} blob={file} alt={file.name} className="aspect-square w-full rounded-md bg-zinc-950 object-cover" />
          ))}
          {files.length > MAX_PREVIEWS && (
            <div className="flex aspect-square items-center justify-center rounded-md bg-zinc-950 text-zinc-400">
              +{files.length - MAX_PREVIEWS}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-zinc-400">Categorias {files.length > 1 && '(aplicadas a todas)'}</span>
          <TagInput placeholder="Adicionar categoria…" value={categories} onChange={setCategories} suggestions={suggestions} />
        </div>

        <p className="text-xs text-zinc-500">
          As imagens são reduzidas para no máximo 2560px e comprimidas antes de ir para o GitHub.
        </p>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-md border border-red-900/60 bg-red-950/40 p-2 text-xs text-red-300">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
