import { Check, Plus, Trash2, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import type { CellValue, Field, SelectOption } from '../../db/databaseTypes'
import { addOption, deleteOption, OPTION_COLORS } from '../../db/databases'
import { ConfirmDialog } from '../Modal'
import { Popover } from '../Popover'
import { OPTION_COLOR_CLASSES } from './fieldTypes'

export function OptionChip({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-xs ${OPTION_COLOR_CLASSES[option.color]}`}
    >
      <span className="truncate">{option.name}</span>
      {onRemove && (
        <button onClick={onRemove} title={`Remover ${option.name}`} className="rounded opacity-70 hover:opacity-100">
          <X size={11} />
        </button>
      )}
    </span>
  )
}

interface OptionPickerProps {
  schemaPath: string
  field: Field
  value: CellValue
  anchor: HTMLElement
  onChange: (value: CellValue) => void
  onClose: () => void
}

export function OptionPicker({ schemaPath, field, value, anchor, onChange, onClose }: OptionPickerProps) {
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SelectOption | null>(null)
  const multi = field.type === 'multi_select'
  const options = field.options ?? []
  const byId = new Map(options.map((option) => [option.id, option]))
  const selectedIds = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((id) => byId.has(id))
  const search = query.trim().toLowerCase()
  const visible = options.filter((option) => option.name.toLowerCase().includes(search))
  const exact = options.find((option) => option.name.toLowerCase() === search)

  function toggle(id: string) {
    if (multi) {
      onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
    } else {
      onChange(selectedIds[0] === id ? null : id)
      onClose()
    }
  }

  async function create() {
    const id = await addOption(schemaPath, field.id, query)
    setQuery('')
    toggle(id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (exact) toggle(exact.id)
      else if (search) void create()
    } else if (event.key === 'Backspace' && !query && multi && selectedIds.length) {
      onChange(selectedIds.slice(0, -1))
    }
  }

  return (
    <>
      <Popover anchor={anchor} onClose={onClose} className="w-64">
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 p-2">
          {selectedIds.map((id) => (
            <OptionChip key={id} option={byId.get(id)!} onRemove={() => onChange(multi ? selectedIds.filter((x) => x !== id) : null)} />
          ))}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar ou criar opção…"
            className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {visible.map((option) => (
            <div key={option.id} className="group flex items-center gap-1 rounded hover:bg-zinc-800">
              <button onClick={() => toggle(option.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left">
                <OptionChip option={option} />
                {selectedIds.includes(option.id) && <Check size={14} className="ml-auto shrink-0 text-sky-400" />}
              </button>
              <button
                onClick={() => setPendingDelete(option)}
                title="Excluir opção"
                className="mr-1 rounded p-1 text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {search && !exact && (
            <button onClick={() => void create()} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-800">
              <Plus size={14} className="text-zinc-500" /> Criar
              <OptionChip option={{ id: '', name: query.trim(), color: OPTION_COLORS[options.length % OPTION_COLORS.length] }} />
            </button>
          )}
          {options.length === 0 && !search && <p className="px-2 py-1.5 text-xs text-zinc-500">Digite para criar uma opção.</p>}
        </div>
      </Popover>
      {pendingDelete && (
        <ConfirmDialog
          title="Excluir opção"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir a opção <strong className="text-zinc-100">{pendingDelete.name}</strong>? Células que usam essa opção
              ficam sem valor.
            </p>
          }
          onConfirm={() => {
            void deleteOption(schemaPath, field.id, pendingDelete.id)
            if (selectedIds.includes(pendingDelete.id)) {
              onChange(multi ? selectedIds.filter((id) => id !== pendingDelete.id) : null)
            }
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
