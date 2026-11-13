import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DatabaseSchema } from '../../db/db'
import type { CellValue, Field, Filter, Sort } from '../../db/databaseTypes'
import { setViewConfig } from '../../db/databases'
import { FILTER_OP_LABELS, FILTER_OPS, opNeedsValue } from '../../lib/databaseQuery'
import { Popover } from '../Popover'

const FILTER_INPUT_DEBOUNCE_MS = 300

const controlClass =
  'min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-sky-500 [color-scheme:dark]'

function defaultFilterValue(field: Field): CellValue {
  return field.type === 'checkbox' ? true : null
}

// Text inputs keep a local draft: committing every keystroke through IndexedDB would make the input lag and drop characters.
function DebouncedInput({ type, value, onCommit }: { type: 'text' | 'number'; value: CellValue; onCommit: (value: CellValue) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <input
      type={type}
      step={type === 'number' ? 'any' : undefined}
      value={draft}
      placeholder="Valor…"
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          if (!next.trim()) onCommit(null)
          else onCommit(type === 'number' ? Number(next) : next)
        }, FILTER_INPUT_DEBOUNCE_MS)
      }}
      className={`${controlClass} w-full`}
    />
  )
}

function FilterValueInput({ field, filter, onChange }: { field: Field; filter: Filter; onChange: (value: CellValue) => void }) {
  if (!opNeedsValue(filter.op)) return <span />

  switch (field.type) {
    case 'select':
    case 'multi_select':
      return (
        <select value={String(filter.value ?? '')} onChange={(e) => onChange(e.target.value || null)} className={controlClass}>
          <option value="">Escolha…</option>
          {(field.options ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )
    case 'checkbox':
      return (
        <select value={filter.value === true ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')} className={controlClass}>
          <option value="true">Marcado</option>
          <option value="false">Desmarcado</option>
        </select>
      )
    case 'date':
      return (
        <input
          type="date"
          value={String(filter.value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className={controlClass}
        />
      )
    default:
      return (
        <DebouncedInput
          key={`${filter.id}:${filter.field}`}
          type={field.type === 'number' ? 'number' : 'text'}
          value={filter.value}
          onCommit={onChange}
        />
      )
  }
}

interface ViewPopoverProps {
  schema: DatabaseSchema
  anchor: HTMLElement
  onClose: () => void
}

export function FilterPopover({ schema, anchor, onClose }: ViewPopoverProps) {
  const fields = new Map(schema.fields.map((field) => [field.id, field]))
  const filters = schema.view.filters.filter((filter) => fields.has(filter.field))

  function update(change: (filters: Filter[]) => Filter[]) {
    void setViewConfig(schema.path, (view) => ({ ...view, filters: change(view.filters) }))
  }

  function patch(id: string, change: Partial<Filter>) {
    update((all) => all.map((filter) => (filter.id === id ? { ...filter, ...change } : filter)))
  }

  function add() {
    const field = schema.fields[0]
    update((all) => [
      ...all,
      { id: crypto.randomUUID().slice(0, 8), field: field.id, op: FILTER_OPS[field.type][0], value: defaultFilterValue(field) },
    ])
  }

  return (
    <Popover anchor={anchor} onClose={onClose} className="w-[34rem] max-w-[calc(100vw-1rem)] p-2">
      {filters.length === 0 && <p className="px-1 pb-2 text-xs text-zinc-500">Nenhum filtro. As linhas precisam atender a todos os filtros.</p>}
      <div className="space-y-1.5">
        {filters.map((filter) => {
          const field = fields.get(filter.field)!
          return (
            <div key={filter.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] items-center gap-1.5">
              <select
                value={filter.field}
                onChange={(e) => {
                  const next = fields.get(e.target.value)!
                  patch(filter.id, { field: next.id, op: FILTER_OPS[next.type][0], value: defaultFilterValue(next) })
                }}
                className={controlClass}
              >
                {schema.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                value={filter.op}
                onChange={(e) => patch(filter.id, { op: e.target.value as Filter['op'] })}
                className={controlClass}
              >
                {FILTER_OPS[field.type].map((op) => (
                  <option key={op} value={op}>
                    {FILTER_OP_LABELS[op]}
                  </option>
                ))}
              </select>
              <FilterValueInput field={field} filter={filter} onChange={(value) => patch(filter.id, { value })} />
              <button
                onClick={() => update((all) => all.filter((f) => f.id !== filter.id))}
                title="Remover filtro"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
        <Plus size={13} /> Adicionar filtro
      </button>
    </Popover>
  )
}

export function SortPopover({ schema, anchor, onClose }: ViewPopoverProps) {
  const fields = new Map(schema.fields.map((field) => [field.id, field]))
  const sorts = schema.view.sorts.filter((sort) => fields.has(sort.field))
  const unused = schema.fields.filter((field) => !sorts.some((sort) => sort.field === field.id))

  function update(change: (sorts: Sort[]) => Sort[]) {
    void setViewConfig(schema.path, (view) => ({ ...view, sorts: change(view.sorts) }))
  }

  return (
    <Popover anchor={anchor} onClose={onClose} className="w-80 p-2">
      {sorts.length === 0 && <p className="px-1 pb-2 text-xs text-zinc-500">Nenhuma ordenação. As linhas seguem a ordem de criação.</p>}
      <div className="space-y-1.5">
        {sorts.map((sort, index) => (
          <div key={sort.field} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5">
            <select
              value={sort.field}
              onChange={(e) => update((all) => all.map((s, i) => (i === index ? { ...s, field: e.target.value } : s)))}
              className={controlClass}
            >
              {schema.fields
                .filter((field) => field.id === sort.field || unused.includes(field))
                .map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
            </select>
            <select
              value={sort.direction}
              onChange={(e) =>
                update((all) => all.map((s, i) => (i === index ? { ...s, direction: e.target.value as Sort['direction'] } : s)))
              }
              className={controlClass}
            >
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
            <button
              onClick={() => update((all) => all.filter((_, i) => i !== index))}
              title="Remover ordenação"
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {unused.length > 0 && (
        <button
          onClick={() => update((all) => [...all, { field: unused[0].id, direction: 'asc' }])}
          className="mt-2 flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Plus size={13} /> Adicionar ordenação
        </button>
      )}
    </Popover>
  )
}
