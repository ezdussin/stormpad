import { fileNameOf } from './paths'

export interface NoteMeta {
  title: string
  tags: string[]
  /** Lucide icon id from `appIcons`; null means the default note icon. */
  icon: string | null
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '')
}

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const frontmatter = content.match(FRONTMATTER_RE)?.[0] ?? ''
  return { frontmatter, body: content.slice(frontmatter.length) }
}

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return {}
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return fields
}

export function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // fall through to the lenient `[a, b]` form
  }
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(unquote)
    .filter(Boolean)
}

export function setFrontmatterField(content: string, key: string, value: string): string {
  return content.replace(FRONTMATTER_RE, (block) => block.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: ${value}`))
}

/** Sets a frontmatter field, inserting it before the closing `---` when missing. */
export function upsertFrontmatterField(content: string, key: string, value: string): string {
  if (!FRONTMATTER_RE.test(content)) {
    return `---\n${key}: ${value}\n---\n${content}`
  }
  const block = content.match(FRONTMATTER_RE)![0]
  if (new RegExp(`^${key}:`, 'm').test(block)) return setFrontmatterField(content, key, value)
  return content.replace(FRONTMATTER_RE, (matched) => matched.replace(/\r?\n---\r?\n?$/, `\n${key}: ${value}\n---\n`))
}

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, '')
}

export function parseNoteMeta(path: string, content: string): NoteMeta {
  const fields = parseFrontmatter(content)
  const heading = stripFrontmatter(content).match(/^#\s+(.+)$/m)?.[1]
  const title = (fields.title && unquote(fields.title)) || heading?.trim() || fileNameOf(path)
  const iconRaw = fields.icon ? unquote(fields.icon) : ''
  return { title, tags: parseTags(fields.tags), icon: iconRaw || null }
}

export function newNoteContent(id: string, now: Date, { title, tags }: { title: string; tags: string[] }): string {
  const timestamp = now.toISOString()
  return [
    '---',
    `id: "${id}"`,
    `tags: ${JSON.stringify(tags)}`,
    'pinned: false',
    `created_at: "${timestamp}"`,
    `updated_at: "${timestamp}"`,
    '---',
    '',
    ...(title.trim() ? [`# ${title.trim()}`, ''] : []),
  ].join('\n')
}
