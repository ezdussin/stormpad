import type { ReactNode } from 'react'
import type { Note } from '../db/db'
import { parseFrontmatter, parseTags, unquote } from '../lib/frontmatter'
import { Modal } from './Modal'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function PropertyValue({ name, raw }: { name: string; raw: string }) {
  if (name === 'tags') {
    const tags = parseTags(raw)
    if (tags.length === 0) return <span className="text-zinc-600">—</span>
    return (
      <span className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
            {tag}
          </span>
        ))}
      </span>
    )
  }
  const value = unquote(raw)
  const text = ISO_DATE_RE.test(value) ? new Date(value).toLocaleString() : value
  return <span className="break-all">{text || '—'}</span>
}

function PropertyRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-zinc-500">{name}</dt>
      <dd className="text-zinc-300">{children}</dd>
    </div>
  )
}

export function PropertiesModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const fields = Object.entries(parseFrontmatter(note.content))

  return (
    <Modal title="Propriedades" onClose={onClose}>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
        {fields.map(([name, raw]) => (
          <PropertyRow key={name} name={name}>
            <PropertyValue name={name} raw={raw} />
          </PropertyRow>
        ))}
        <PropertyRow name="caminho">
          <span className="break-all">{note.path}</span>
        </PropertyRow>
      </dl>
    </Modal>
  )
}
