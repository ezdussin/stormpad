import { ExternalLink } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import type { DatabaseRow } from '../../db/db'
import type { CellValue, Field } from '../../db/databaseTypes'
import { setRowValue } from '../../db/databases'
import { selectedOptions } from '../../lib/databaseQuery'
import { absoluteUrl, openExternal } from '../../lib/openExternal'
import { OptionChip, OptionPicker } from './OptionPicker'

const cellBox = 'min-h-[34px] px-2 py-1.5'

function toInput(value: CellValue): string {
  return value === null || value === undefined ? '' : String(value)
}

function fromInput(draft: string, field: Field): CellValue {
  const text = draft.trim()
  if (!text) return null
  if (field.type === 'number') {
    const number = Number(text.replace(',', '.'))
    return Number.isFinite(number) ? number : null
  }
  return text
}

function formatValue(value: CellValue, field: Field) {
  if (value === null || value === undefined || value === '') return null
  if (field.type === 'number' && typeof value === 'number') return value.toLocaleString()
  if (field.type === 'date' && typeof value === 'string') return new Date(`${value}T00:00`).toLocaleDateString()
  if (field.type === 'url' && typeof value === 'string') {
    return (
      <a
        href={absoluteUrl(value)}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openExternal(value)
        }}
        className="inline-flex max-w-full items-center gap-1 text-sky-400 underline underline-offset-2"
      >
        <span className="truncate">{value}</span>
        <ExternalLink size={12} className="shrink-0" />
      </a>
    )
  }
  return String(value)
}

interface InputCellProps {
  field: Field
  value: CellValue
  autoEdit?: boolean
  onSave: (value: CellValue) => void
}

function InputCell({ field, value, autoEdit = false, onSave }: InputCellProps) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(() => toInput(value))

  function start() {
    setDraft(toInput(value))
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const next = fromInput(draft, field)
    if (next !== (value ?? null)) onSave(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit()
    else if (event.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        step={field.type === 'number' ? 'any' : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className={`${cellBox} w-full bg-zinc-900 outline outline-2 -outline-offset-2 outline-sky-500 [color-scheme:dark]`}
      />
    )
  }

  return (
    <div
      onClick={start}
      className={`${cellBox} cursor-text truncate ${field.type === 'title' ? 'font-medium' : ''} ${
        field.type === 'number' ? 'text-right tabular-nums' : ''
      }`}
    >
      {formatValue(value, field)}
    </div>
  )
}

function OptionCell({ schemaPath, field, value, onSave }: { schemaPath: string; field: Field; value: CellValue; onSave: (value: CellValue) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <div onClick={(e) => setAnchor(e.currentTarget)} className={`${cellBox} flex cursor-pointer flex-wrap items-center gap-1`}>
        {selectedOptions(value, field).map((option) => (
          <OptionChip key={option.id} option={option} />
        ))}
      </div>
      {anchor && (
        <OptionPicker
          schemaPath={schemaPath}
          field={field}
          value={value}
          anchor={anchor}
          onChange={onSave}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  )
}

interface CellProps {
  schemaPath: string
  field: Field
  row: DatabaseRow
  autoEdit?: boolean
}

export function Cell({ schemaPath, field, row, autoEdit }: CellProps) {
  const value = row.values[field.id] ?? null
  const save = (next: CellValue) => void setRowValue(row.path, field.id, next)

  if (field.type === 'checkbox') {
    return (
      <div className={`${cellBox} flex items-center`}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => save(e.target.checked)}
          className="size-4 cursor-pointer accent-sky-500"
        />
      </div>
    )
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    return <OptionCell schemaPath={schemaPath} field={field} value={value} onSave={save} />
  }
  return <InputCell key={`${row.path}:${field.type}`} field={field} value={value} autoEdit={autoEdit} onSave={save} />
}
