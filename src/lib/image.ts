import { extensionOf } from './paths'

const MAX_DIMENSION = 2560
const QUALITY = 0.85

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

export function mimeTypeOf(path: string): string {
  return MIME_BY_EXTENSION[extensionOf(path)] ?? 'application/octet-stream'
}

export interface PreparedImage {
  blob: Blob
  extension: string
  width: number
  height: number
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao comprimir a imagem.'))), type, QUALITY),
  )
}

function original(file: File, width: number, height: number): PreparedImage {
  return { blob: file, extension: EXTENSION_BY_MIME[file.type] ?? (extensionOf(file.name) || 'bin'), width, height }
}

// Animated GIFs and SVGs would lose animation/vector data on a canvas round-trip, so they're stored as-is.
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.type === 'image/svg+xml') return original(file, 0, 0)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`Formato de imagem não suportado neste navegador: ${file.name}`)
  }
  const { width, height } = bitmap
  if (file.type === 'image/gif') {
    bitmap.close()
    return original(file, width, height)
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // Safari can't encode WebP and silently returns PNG instead.
  let blob = await canvasToBlob(canvas, 'image/webp')
  if (blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg')

  if (scale === 1 && file.size <= blob.size && EXTENSION_BY_MIME[file.type]) return original(file, width, height)
  return { blob, extension: EXTENSION_BY_MIME[blob.type], width: canvas.width, height: canvas.height }
}
