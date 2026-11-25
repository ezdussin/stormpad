export const NOTES_ROOT = 'notes/'

export function fileNameOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/, '')
}

// Characters Windows refuses in file names, so the repo stays checkout-able everywhere.
const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/
const MAX_FILE_NAME_LENGTH = 120

export function normalizeFileName(name: string): string {
  return name.trim().replace(/\.md$/i, '')
}

export function validateFileName(name: string): string | null {
  const normalized = normalizeFileName(name)
  if (!normalized) return 'Informe um nome.'
  if (INVALID_FILE_NAME_CHARS.test(normalized)) return 'O nome não pode conter / \\ : * ? " < > |'
  if (normalized.startsWith('.')) return 'O nome não pode começar com ponto.'
  if (normalized.length > MAX_FILE_NAME_LENGTH) return `O nome pode ter no máximo ${MAX_FILE_NAME_LENGTH} caracteres.`
  return null
}

/** Normalize to `notes/.../` (always under notes/, always trailing slash). */
export function normalizeNoteFolder(folder: string): string {
  let value = folder.trim().replace(/\\/g, '/')
  if (!value.startsWith(NOTES_ROOT)) value = `${NOTES_ROOT}${value.replace(/^\/+/, '')}`
  value = value.replace(/\/{2,}/g, '/')
  if (!value.endsWith('/')) value += '/'
  return value
}

export function validateFolderName(name: string): string | null {
  const normalized = name.trim()
  if (!normalized) return 'Informe um nome.'
  if (INVALID_FILE_NAME_CHARS.test(normalized)) return 'O nome não pode conter / \\ : * ? " < > |'
  if (normalized.startsWith('.')) return 'O nome não pode começar com ponto.'
  if (normalized.length > MAX_FILE_NAME_LENGTH) return `O nome pode ter no máximo ${MAX_FILE_NAME_LENGTH} caracteres.`
  return null
}

/** Display label for a note folder path, e.g. `notes/inbox/` → `inbox`. */
export function folderLabel(folder: string): string {
  const normalized = normalizeNoteFolder(folder)
  const relative = normalized.slice(NOTES_ROOT.length).replace(/\/$/, '')
  return relative || 'notes'
}

export function joinNoteFolder(parent: string, name: string): string {
  return normalizeNoteFolder(`${normalizeNoteFolder(parent)}${name.trim()}`)
}

/** Immediate child folder name, e.g. parent `notes/` + `notes/inbox/` → `inbox`. */
export function childFolderName(parent: string, folder: string): string {
  const base = normalizeNoteFolder(parent)
  const full = normalizeNoteFolder(folder)
  if (!full.startsWith(base) || full === base) return folderLabel(full)
  return full.slice(base.length).replace(/\/$/, '').split('/')[0] ?? folderLabel(full)
}

/** Breadcrumb crumbs from `notes/` down to `folder` (inclusive). */
export function folderBreadcrumbs(folder: string): { path: string; label: string }[] {
  const normalized = normalizeNoteFolder(folder)
  const crumbs: { path: string; label: string }[] = [{ path: NOTES_ROOT, label: 'Notas' }]
  if (normalized === NOTES_ROOT) return crumbs
  const relative = normalized.slice(NOTES_ROOT.length).replace(/\/$/, '')
  let current = NOTES_ROOT
  for (const segment of relative.split('/').filter(Boolean)) {
    current = `${current}${segment}/`
    crumbs.push({ path: current, label: segment })
  }
  return crumbs
}

/** Direct child folders of `parent` from a flat folder list. */
export function childFoldersOf(parent: string, folders: string[]): string[] {
  const base = normalizeNoteFolder(parent)
  const children = new Set<string>()
  for (const folder of folders) {
    const full = normalizeNoteFolder(folder)
    if (!full.startsWith(base) || full === base) continue
    const rest = full.slice(base.length).replace(/\/$/, '')
    const first = rest.split('/')[0]
    if (first) children.add(`${base}${first}/`)
  }
  return [...children].sort((a, b) => childFolderName(base, a).localeCompare(childFolderName(base, b), 'pt-BR'))
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, MAX_FILE_NAME_LENGTH)
}

export function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1)
}

export function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
}

/** `<root>/YYYY/MM/<timestamp>-<random>`, without extension. */
export function datedBasePath(root: string, date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${root}/${year}/${month}/${timestampSlug(date)}-${crypto.randomUUID().slice(0, 8)}`
}
