// Raw btoa/atob only handle Latin-1, so strings go through UTF-8 bytes first
// to keep accents and emojis intact.

const CHUNK_SIZE = 0x8000

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64.replace(/\s/g, ''))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function base64ToUtf8(base64: string): string {
  return new TextDecoder().decode(base64ToBytes(base64))
}

export function base64ToBlob(base64: string, type: string): Blob {
  return new Blob([base64ToBytes(base64)], { type })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(blob)
  })
}
