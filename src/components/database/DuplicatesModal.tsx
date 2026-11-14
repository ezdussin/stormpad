import { AlertTriangle, CopyCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DatabaseRow, DatabaseSchema } from '../../db/db'
import { TITLE_FIELD_ID } from '../../db/databaseTypes'
import { deleteRows } from '../../db/databases'
import { displayText, findDuplicates } from '../../lib/databaseQuery'
import { Modal } from '../Modal'
import { FIELD_TYPES } from './fieldTypes'

const checkboxClass = 'size-4 cursor-pointer accent-sky-500'

/** Every row of each group except the oldest, which is the one kept by default. */
function defaultSelection(groups: DatabaseRow[][]): Set<string> {
  return new Set(groups.flatMap((group) => group.slice(1).map((row) => row.path)))
}

interface DuplicatesModalProps {
  schema: DatabaseSchema
  rows: DatabaseRow[]
  onClose: () => void
}

export function DuplicatesModal({ schema, rows, onClose }: DuplicatesModalProps) {
  const [step, setStep] = useState<'fields' | 'review'>('fields')
  const [fieldIds, setFieldIds] = useState<Set<string>>(() => new Set([TITLE_FIELD_ID]))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const compareFields = useMemo(() => schema.fields.filter((field) => fieldIds.has(field.id)), [schema.fields, fieldIds])
  // Recomputed live, so rows deleted or edited elsewhere drop out of the review.
  const groups = useMemo(() => findDuplicates(rows, compareFields), [rows, compareFields])
  const selectedPaths = groups.flat().filter((row) => selected.has(row.path)).map((row) => row.path)
  const fullySelectedGroups = groups.filter((group) => group.every((row) => selected.has(row.path))).length

  function toggleField(id: string) {
    setFieldIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleRow(path: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function toggleGroup(group: DatabaseRow[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const row of group) {
        if (checked) next.add(row.path)
        else next.delete(row.path)
      }
      return next
    })
  }

  function search() {
    setSelected(defaultSelection(findDuplicates(rows, compareFields)))
    setStep('review')
  }

  async function removeSelected() {
    setDeleting(true)
    await deleteRows(selectedPaths)
    onClose()
  }

  if (step === 'fields') {
    return (
      <Modal
        title="Procurar duplicatas"
        onClose={onClose}
        footer={
          <>
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </button>
            <button
              onClick={search}
              disabled={compareFields.length === 0}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
            >
              Procurar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-zinc-400">
            Linhas com o mesmo valor em <strong className="text-zinc-200">todos</strong> os campos marcados são consideradas
            duplicadas. Maiúsculas, acentos e espaços extras são ignorados.
          </p>
          <div className="space-y-0.5 rounded-md border border-zinc-800 p-1">
            {schema.fields.map((field) => {
              const { icon: Icon } = FIELD_TYPES[field.type]
              return (
                <label key={field.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-zinc-800/60">
                  <input type="checkbox" checked={fieldIds.has(field.id)} onChange={() => toggleField(field.id)} className={checkboxClass} />
                  <Icon size={14} className="text-zinc-500" />
                  {field.name}
                </label>
              )
            })}
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Duplicatas por ${compareFields.map((field) => field.name).join(' + ')}`}
      onClose={deleting ? () => {} : onClose}
      size="xl"
      footer={
        <>
          <button onClick={() => setStep('fields')} disabled={deleting} className="mr-auto rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
            Voltar
          </button>
          <button onClick={onClose} disabled={deleting} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
            Cancelar
          </button>
          <button
            onClick={() => void removeSelected()}
            disabled={selectedPaths.length === 0 || deleting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40"
          >
            {deleting ? 'Excluindo…' : `Excluir ${selectedPaths.length} linha(s)`}
          </button>
        </>
      }
    >
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-zinc-500">
          <CopyCheck size={28} className="text-zinc-700" />
          Nenhuma duplicata encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-400">
              {groups.length} grupo(s), {groups.flat().length} linhas. As marcadas serão excluídas; a mais antiga de cada grupo
              vem desmarcada.
            </span>
            <button onClick={() => setSelected(new Set(groups.flat().map((row) => row.path)))} className="text-sky-400 hover:underline">
              Marcar todas
            </button>
            <button onClick={() => setSelected(defaultSelection(groups))} className="text-sky-400 hover:underline">
              Manter a mais antiga
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sky-400 hover:underline">
              Desmarcar todas
            </button>
          </div>

          {fullySelectedGroups > 0 && (
            <p className="flex items-center gap-2 rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle size={14} className="shrink-0" />
              Em {fullySelectedGroups} grupo(s) todas as linhas estão marcadas: nenhuma cópia será mantida.
            </p>
          )}

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {groups.map((group, index) => {
              const allChecked = group.every((row) => selected.has(row.path))
              return (
                <section key={group[0].path} className="overflow-hidden rounded-md border border-zinc-800">
                  <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleGroup(group, e.target.checked)}
                      title="Marcar ou desmarcar o grupo"
                      className={checkboxClass}
                    />
                    Grupo {index + 1} · {group.length} linhas
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-max min-w-full text-sm">
                      <thead className="text-left text-xs text-zinc-500">
                        <tr>
                          <th className="w-8" />
                          {schema.fields.map((field) => (
                            <th
                              key={field.id}
                              className={`px-2 py-1 font-normal ${fieldIds.has(field.id) ? 'text-sky-300' : ''}`}
                            >
                              {field.name}
                            </th>
                          ))}
                          <th className="px-2 py-1 font-normal">Criada em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((row, rowIndex) => (
                          <tr
                            key={row.path}
                            onClick={() => toggleRow(row.path)}
                            className={`cursor-pointer border-t border-zinc-800/70 ${
                              selected.has(row.path) ? 'bg-red-950/30 text-zinc-400 line-through decoration-zinc-600' : 'hover:bg-zinc-800/40'
                            }`}
                          >
                            <td className="px-2 py-1.5 align-top">
                              <input
                                type="checkbox"
                                checked={selected.has(row.path)}
                                onChange={() => toggleRow(row.path)}
                                onClick={(e) => e.stopPropagation()}
                                className={checkboxClass}
                              />
                            </td>
                            {schema.fields.map((field) => (
                              <td key={field.id} className="max-w-56 truncate px-2 py-1.5 align-top">
                                {displayText(row.values[field.id], field)}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 align-top whitespace-nowrap text-xs text-zinc-500 no-underline">
                              {new Date(row.createdAt).toLocaleString()}
                              {rowIndex === 0 && <span className="ml-1.5 rounded bg-zinc-800 px-1 text-zinc-400">mais antiga</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
