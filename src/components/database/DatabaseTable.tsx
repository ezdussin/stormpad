import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CopyCheck,
  CopyPlus,
  FileUp,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef, useState, type DragEvent, type MouseEvent, type Ref } from 'react'
import type { DatabaseRow, DatabaseSchema } from '../../db/db'
import type { Field, Sort } from '../../db/databaseTypes'
import { addRow, deleteField, deleteRow, duplicateRow, moveField, setViewConfig, useDatabaseRows } from '../../db/databases'
import { applyView, FILTER_OPS, searchRows } from '../../lib/databaseQuery'
import { formatOf, loadImportFile, type LoadedFile } from '../../lib/importFile'
import { ConfirmDialog } from '../Modal'
import { useContextMenu } from '../useContextMenu'
import { Cell } from './Cell'
import { DuplicatesModal } from './DuplicatesModal'
import { FieldModal } from './FieldModal'
import { FIELD_TYPES } from './fieldTypes'
import { ImportModal } from './ImportModal'
import { FilterPopover, SortPopover } from './ViewPopovers'

interface ToolbarButtonProps {
  icon: LucideIcon
  label: string
  count: number
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  buttonRef?: Ref<HTMLButtonElement>
}

function ToolbarButton({ icon: Icon, label, count, onClick, buttonRef }: ToolbarButtonProps) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-zinc-800 ${
        count ? 'text-sky-300' : 'text-zinc-400'
      }`}
    >
      <Icon size={15} /> {label}
      {count > 0 && <span className="rounded bg-sky-500/20 px-1.5 text-xs">{count}</span>}
    </button>
  )
}

export function DatabaseTable({ schema }: { schema: DatabaseSchema }) {
  const rows = useDatabaseRows(schema.dir)
  const menu = useContextMenu()
  const filterButton = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState<{ kind: 'filter' | 'sort'; anchor: HTMLElement } | null>(null)
  const [fieldModal, setFieldModal] = useState<{ field?: Field } | null>(null)
  const [pendingFieldDelete, setPendingFieldDelete] = useState<Field | null>(null)
  const [pendingRowDelete, setPendingRowDelete] = useState<DatabaseRow | null>(null)
  const [newRowPath, setNewRowPath] = useState<string | null>(null)
  const [importing, setImporting] = useState<{ file?: LoadedFile } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState('')
  const [findingDuplicates, setFindingDuplicates] = useState(false)
  const { fields } = schema

  function handleDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDragging(true)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && formatOf(file)) void loadImportFile(file).then((loaded) => setImporting({ file: loaded }))
  }

  const visibleRows = useMemo(() => {
    const result = searchRows(applyView(rows ?? [], schema), schema.fields, query)
    // A freshly added row stays visible even if the filters or search would hide it, so it can be filled in.
    const fresh = rows?.find((row) => row.path === newRowPath)
    return fresh && !result.includes(fresh) ? [...result, fresh] : result
  }, [rows, schema, newRowPath, query])

  function togglePopover(kind: 'filter' | 'sort', anchor: HTMLElement) {
    setPopover((current) => (current?.kind === kind ? null : { kind, anchor }))
  }

  function sortBy(field: Field, direction: Sort['direction']) {
    void setViewConfig(schema.path, (view) => ({
      ...view,
      sorts: [{ field: field.id, direction }, ...view.sorts.filter((sort) => sort.field !== field.id)],
    }))
  }

  async function filterBy(field: Field) {
    await setViewConfig(schema.path, (view) => ({
      ...view,
      filters: [
        ...view.filters,
        { id: crypto.randomUUID().slice(0, 8), field: field.id, op: FILTER_OPS[field.type][0], value: field.type === 'checkbox' ? true : null },
      ],
    }))
    if (filterButton.current) setPopover({ kind: 'filter', anchor: filterButton.current })
  }

  function openFieldMenu(event: MouseEvent, field: Field) {
    const index = fields.indexOf(field)
    menu.open(event, [
      { label: 'Editar campo', icon: Pencil, onSelect: () => setFieldModal({ field }) },
      'separator',
      { label: 'Ordenar crescente', icon: ArrowUp, onSelect: () => sortBy(field, 'asc') },
      { label: 'Ordenar decrescente', icon: ArrowDown, onSelect: () => sortBy(field, 'desc') },
      { label: 'Filtrar por este campo', icon: ListFilter, onSelect: () => filterBy(field) },
      'separator',
      { label: 'Mover para a esquerda', icon: ArrowLeft, disabled: index <= 1, onSelect: () => moveField(schema.path, field.id, -1) },
      {
        label: 'Mover para a direita',
        icon: ArrowRight,
        disabled: index === 0 || index === fields.length - 1,
        onSelect: () => moveField(schema.path, field.id, 1),
      },
      'separator',
      {
        label: 'Excluir campo',
        icon: Trash2,
        danger: true,
        disabled: field.type === 'title',
        onSelect: () => setPendingFieldDelete(field),
      },
    ])
  }

  function openRowMenu(event: MouseEvent, row: DatabaseRow) {
    menu.open(event, [
      {
        label: 'Duplicar linha',
        icon: CopyPlus,
        onSelect: async () => {
          const copy = await duplicateRow(row.path)
          if (copy) setNewRowPath(copy)
        },
      },
      'separator',
      { label: 'Excluir linha', icon: Trash2, danger: true, onSelect: () => setPendingRowDelete(row) },
    ])
  }

  const total = rows?.length ?? 0
  const sortDirection = new Map(schema.view.sorts.map((sort) => [sort.field, sort.direction]))

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <h1 className="truncate text-sm font-semibold">{schema.name}</h1>
        <span className="shrink-0 text-xs text-zinc-500">
          {visibleRows.length === total ? total : `${visibleRows.length} de ${total}`}
        </span>
        <label className="ml-3 flex w-72 min-w-40 shrink items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 focus-within:border-sky-500">
          <Search size={14} className="shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Buscar…"
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} title="Limpar busca" className="rounded p-0.5 text-zinc-500 hover:text-zinc-200">
              <X size={13} />
            </button>
          )}
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ToolbarButton
            buttonRef={filterButton}
            icon={ListFilter}
            label="Filtro"
            count={schema.view.filters.length}
            onClick={(e) => togglePopover('filter', e.currentTarget)}
          />
          <ToolbarButton
            icon={ArrowUpDown}
            label="Ordenar"
            count={schema.view.sorts.length}
            onClick={(e) => togglePopover('sort', e.currentTarget)}
          />
          <ToolbarButton icon={CopyCheck} label="Duplicatas" count={0} onClick={() => setFindingDuplicates(true)} />
          <ToolbarButton icon={FileUp} label="Importar" count={0} onClick={() => setImporting({})} />
          <button
            onClick={async () => setNewRowPath(await addRow(schema.dir))}
            className="ml-1 flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500"
          >
            <Plus size={16} /> Nova linha
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950">
            <tr>
              {fields.map((field) => {
                const { icon: Icon } = FIELD_TYPES[field.type]
                const direction = sortDirection.get(field.id)
                return (
                  <th
                    key={field.id}
                    className={`border-r border-b border-zinc-800 p-0 text-left font-normal ${
                      field.type === 'title' ? 'min-w-64' : 'min-w-44'
                    }`}
                  >
                    <button
                      onClick={(e) => openFieldMenu(e, field)}
                      onContextMenu={(e) => openFieldMenu(e, field)}
                      className="flex w-full items-center gap-1.5 px-2 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{field.name}</span>
                      {direction && (
                        <span className="ml-auto text-sky-400">
                          {direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                        </span>
                      )}
                    </button>
                  </th>
                )
              })}
              <th className="w-full border-b border-zinc-800 p-0 text-left">
                <button
                  onClick={() => setFieldModal({})}
                  title="Adicionar campo"
                  className="px-3 py-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                >
                  <Plus size={15} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.path} onContextMenu={(e) => openRowMenu(e, row)} className="hover:bg-zinc-900/40">
                {fields.map((field) => (
                  <td key={field.id} className="max-w-80 border-r border-b border-zinc-800 p-0 align-top">
                    <Cell
                      schemaPath={schema.path}
                      field={field}
                      row={row}
                      autoEdit={row.path === newRowPath && field.type === 'title'}
                    />
                  </td>
                ))}
                <td className="border-b border-zinc-800" />
              </tr>
            ))}
            <tr>
              <td colSpan={fields.length + 1} className="p-0">
                <button
                  onClick={async () => setNewRowPath(await addRow(schema.dir))}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                >
                  <Plus size={14} /> Nova linha
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        {total > 0 && visibleRows.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">
            {query.trim() ? `Nenhuma linha encontrada para "${query.trim()}".` : 'Nenhuma linha corresponde aos filtros.'}
          </p>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-500/10 text-sm font-medium text-sky-200">
          <FileUp size={18} className="mr-2" /> Solte o arquivo CSV, TSV ou JSON para importar
        </div>
      )}
      {findingDuplicates && <DuplicatesModal schema={schema} rows={rows ?? []} onClose={() => setFindingDuplicates(false)} />}
      {importing && (
        <ImportModal target={schema} initialFile={importing.file} onImported={() => {}} onClose={() => setImporting(null)} />
      )}
      {menu.element}
      {popover?.kind === 'filter' && <FilterPopover schema={schema} anchor={popover.anchor} onClose={() => setPopover(null)} />}
      {popover?.kind === 'sort' && <SortPopover schema={schema} anchor={popover.anchor} onClose={() => setPopover(null)} />}
      {fieldModal && <FieldModal schemaPath={schema.path} field={fieldModal.field} onClose={() => setFieldModal(null)} />}
      {pendingFieldDelete && (
        <ConfirmDialog
          title="Excluir campo"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir o campo <strong className="text-zinc-100">{pendingFieldDelete.name}</strong>? Os valores dele em todas as
              linhas deixam de aparecer.
            </p>
          }
          onConfirm={() => {
            void deleteField(schema.path, pendingFieldDelete.id)
            setPendingFieldDelete(null)
          }}
          onCancel={() => setPendingFieldDelete(null)}
        />
      )}
      {pendingRowDelete && (
        <ConfirmDialog
          title="Excluir linha"
          danger
          confirmLabel="Excluir"
          message={<p className="text-zinc-300">Excluir esta linha? Ela também será removida do GitHub no próximo sync.</p>}
          onConfirm={() => {
            void deleteRow(pendingRowDelete.path)
            setPendingRowDelete(null)
          }}
          onCancel={() => setPendingRowDelete(null)}
        />
      )}
    </div>
  )
}
