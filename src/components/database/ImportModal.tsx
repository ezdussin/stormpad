import { FileUp } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import type { DatabaseSchema } from '../../db/db'
import { TITLE_FIELD_ID, type FieldType } from '../../db/databaseTypes'
import { importRecords, type ImportColumn, type ImportResult } from '../../db/databases'
import {
  CSV_DELIMITERS,
  inferFieldType,
  loadImportFile,
  tableFromCsv,
  tableFromJson,
  type ImportTable,
  type LoadedFile,
} from '../../lib/importFile'
import { Modal } from '../Modal'
import { CREATABLE_FIELD_TYPES, FIELD_TYPES } from './fieldTypes'

const LARGE_IMPORT_ROWS = 500
const SAMPLE_VALUES = 3

const controlClass =
  'w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-sky-500'

/** `title` / a field id map onto that field, `new` creates a field of `type`, `skip` ignores the column. */
interface ColumnChoice {
  destination: string
  type: FieldType
}

function defaultChoices(table: ImportTable, target?: DatabaseSchema): ColumnChoice[] {
  return table.headers.map((header, i) => {
    const type = inferFieldType(table.records.map((record) => record[i]))
    if (!target) return { destination: i === 0 ? TITLE_FIELD_ID : 'new', type }
    const match = target.fields.find((field) => field.name.toLowerCase() === header.toLowerCase())
    return { destination: match?.id ?? 'new', type }
  })
}

function sampleOf(table: ImportTable, column: number): string {
  return table.records
    .map((record) => record[column].trim())
    .filter(Boolean)
    .slice(0, SAMPLE_VALUES)
    .join(' · ')
}

function tryParse(file: LoadedFile, delimiter: string, hasHeader: boolean): { table: ImportTable | null; error: string | null } {
  try {
    const table = file.format === 'json' ? tableFromJson(file.text) : tableFromCsv(file.text, delimiter, hasHeader)
    return { table, error: table.records.length ? null : 'Nenhuma linha encontrada no arquivo.' }
  } catch (err) {
    return { table: null, error: `Não foi possível ler o arquivo: ${err instanceof Error ? err.message : String(err)}` }
  }
}

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

interface ImportModalProps {
  /** Database to append to; without it a new database is created from the file. */
  target?: DatabaseSchema
  /** A file already read by the caller (e.g. dropped on the table). */
  initialFile?: LoadedFile
  onImported: (schemaPath: string) => void
  onClose: () => void
}

export function ImportModal({ target, initialFile, onImported, onClose }: ImportModalProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [initial] = useState(() => (initialFile ? tryParse(initialFile, initialFile.delimiter, true) : null))
  const [file, setFile] = useState<LoadedFile | null>(initialFile ?? null)
  const [delimiter, setDelimiter] = useState(initialFile?.delimiter ?? ',')
  const [hasHeader, setHasHeader] = useState(true)
  const [table, setTable] = useState<ImportTable | null>(initial?.table ?? null)
  const [choices, setChoices] = useState<ColumnChoice[]>(() => (initial?.table ? defaultChoices(initial.table, target) : []))
  const [name, setName] = useState(initialFile ? baseName(initialFile.name) : '')
  const [error, setError] = useState<string | null>(initial?.error ?? null)
  const [importing, setImporting] = useState(false)
  const [matchFieldId, setMatchFieldId] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  // Only fields that some column actually fills can serve as the matching key.
  const keyFields = (target?.fields ?? []).filter((field) => choices.some((choice) => choice.destination === field.id))
  const matchField = keyFields.find((field) => field.id === matchFieldId)

  function parse(source: LoadedFile, nextDelimiter: string, header: boolean) {
    const result = tryParse(source, nextDelimiter, header)
    setTable(result.table)
    setChoices(result.table ? defaultChoices(result.table, target) : [])
    setError(result.error)
  }

  async function openFile(picked: File) {
    try {
      const loaded = await loadImportFile(picked)
      setFile(loaded)
      setDelimiter(loaded.delimiter)
      setName((current) => current || baseName(loaded.name))
      parse(loaded, loaded.delimiter, hasHeader)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void openFile(file)
  }

  function setChoice(index: number, change: Partial<ColumnChoice>) {
    setChoices((current) =>
      current.map((choice, i) => {
        if (i === index) return { ...choice, ...change }
        // A new database has exactly one title column.
        if (!target && change.destination === TITLE_FIELD_ID && choice.destination === TITLE_FIELD_ID) {
          return { ...choice, destination: 'new' }
        }
        return choice
      }),
    )
  }

  async function handleImport() {
    if (!table) return
    const titleIndex = choices.findIndex((choice) => choice.destination === TITLE_FIELD_ID)
    const mapped = choices.filter((choice) => choice.destination !== 'skip' && choice.destination !== 'new')
    const duplicated = mapped.find((choice, i) => mapped.findIndex((c) => c.destination === choice.destination) !== i)

    if (!target && !name.trim()) return setError('Informe um nome para o banco de dados.')
    if (!target && titleIndex === -1) return setError('Escolha uma coluna para ser o título.')
    if (duplicated) {
      const field = target?.fields.find((f) => f.id === duplicated.destination)
      return setError(`Mais de uma coluna está indo para o campo "${field?.name ?? 'Título'}".`)
    }
    if (choices.every((choice) => choice.destination === 'skip')) return setError('Escolha ao menos uma coluna para importar.')

    const columns: ImportColumn[] = choices.flatMap((choice, index): ImportColumn[] => {
      if (choice.destination === 'skip') return []
      if (choice.destination === 'new') return [{ index, target: { newField: { name: table.headers[index], type: choice.type } } }]
      return [{ index, target: { fieldId: choice.destination } }]
    })

    setImporting(true)
    try {
      const imported = await importRecords({
        schemaPath: target?.path,
        newDatabase: target ? undefined : { name, titleName: table.headers[titleIndex] },
        columns,
        records: table.records,
        matchFieldId: matchField?.id,
      })
      onImported(imported.schemaPath)
      if (matchField) setResult(imported)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setImporting(false)
  }

  if (result) {
    const unchanged = (table?.records.length ?? 0) - result.created - result.updated
    return (
      <Modal
        title="Importação concluída"
        onClose={onClose}
        footer={
          <button onClick={onClose} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500">
            Fechar
          </button>
        }
      >
        <ul className="space-y-1 text-zinc-300">
          <li>
            <strong className="text-zinc-100">{result.updated}</strong> linha(s) atualizada(s)
          </li>
          <li>
            <strong className="text-zinc-100">{result.created}</strong> linha(s) nova(s)
          </li>
          {unchanged > 0 && (
            <li className="text-zinc-500">
              {unchanged} linha(s) do arquivo já estavam iguais ou repetiam a mesma chave
            </li>
          )}
        </ul>
      </Modal>
    )
  }

  return (
    <Modal
      title={target ? `Importar para "${target.name}"` : 'Importar banco de dados'}
      onClose={importing ? () => {} : onClose}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={importing} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
            Cancelar
          </button>
          <button
            onClick={() => void handleImport()}
            disabled={!table?.records.length || importing}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
          >
            {importing ? 'Importando…' : `Importar ${table?.records.length ?? 0} linha(s)`}
          </button>
        </>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.tsv,.txt,.json,text/csv,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void openFile(file)
          e.target.value = ''
        }}
      />

      <div className="space-y-4">
        {!file ? (
          <button
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 px-4 py-10 text-zinc-400 hover:border-sky-600 hover:text-zinc-200"
          >
            <FileUp size={28} />
            <span>Escolha ou arraste um arquivo CSV, TSV ou JSON</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-zinc-800 px-3 py-2" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <FileUp size={18} className="shrink-0 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate">
              {file.name}
              {table && (
                <span className="text-zinc-500">
                  {' '}
                  · {table.records.length} linha(s) · {table.headers.length} coluna(s)
                </span>
              )}
            </span>
            <button onClick={() => fileInput.current?.click()} className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
              Trocar arquivo
            </button>
          </div>
        )}

        {file?.format === 'csv' && (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-zinc-400">Separador</span>
              <select
                value={delimiter}
                onChange={(e) => {
                  setDelimiter(e.target.value)
                  parse(file, e.target.value, hasHeader)
                }}
                className={`${controlClass} w-auto`}
              >
                {CSV_DELIMITERS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => {
                  setHasHeader(e.target.checked)
                  parse(file, delimiter, e.target.checked)
                }}
                className="size-4 accent-sky-500"
              />
              <span className="text-zinc-300">Primeira linha é o cabeçalho</span>
            </label>
          </div>
        )}

        {!target && file && (
          <label className="block space-y-1">
            <span className="text-zinc-400">Nome do banco de dados</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={controlClass} />
          </label>
        )}

        {table && table.headers.length > 0 && (
          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-normal">Coluna do arquivo</th>
                  <th className="w-44 px-2 py-2 font-normal">Destino</th>
                  <th className="w-40 px-2 py-2 font-normal">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {table.headers.map((header, index) => {
                  const choice = choices[index]
                  if (!choice) return null
                  const existing = target?.fields.find((field) => field.id === choice.destination)
                  return (
                    <tr key={index} className="border-t border-zinc-800 align-top">
                      <td className="max-w-0 px-3 py-2">
                        <div className="truncate font-medium">{header}</div>
                        <div className="truncate text-xs text-zinc-500">{sampleOf(table, index) || '—'}</div>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={choice.destination}
                          onChange={(e) => setChoice(index, { destination: e.target.value })}
                          className={controlClass}
                        >
                          {target ? (
                            <optgroup label="Campos existentes">
                              {target.fields.map((field) => (
                                <option key={field.id} value={field.id}>
                                  {field.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : (
                            <option value={TITLE_FIELD_ID}>Título</option>
                          )}
                          <option value="new">Novo campo</option>
                          <option value="skip">Ignorar</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {choice.destination === 'new' ? (
                          <select
                            value={choice.type}
                            onChange={(e) => setChoice(index, { type: e.target.value as FieldType })}
                            className={controlClass}
                          >
                            {CREATABLE_FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {FIELD_TYPES[type].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="block px-2 py-1 text-zinc-500">
                            {choice.destination === 'skip'
                              ? '—'
                              : FIELD_TYPES[existing?.type ?? 'title'].label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {target && table && (
          <div className="space-y-1.5">
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-400">Linhas que já existem</span>
              <select value={matchField?.id ?? ''} onChange={(e) => setMatchFieldId(e.target.value)} className={`${controlClass} w-auto`}>
                <option value="">Sempre criar linhas novas</option>
                {keyFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    Atualizar quando "{field.name}" for igual
                  </option>
                ))}
              </select>
            </label>
            {matchField && (
              <p className="text-xs text-zinc-500">
                Uma linha do arquivo com o mesmo "{matchField.name}" de uma linha existente atualiza essa linha (sem diferenciar
                maiúsculas). Células vazias no arquivo não apagam valores. As demais viram linhas novas.
              </p>
            )}
          </div>
        )}

        {table && table.records.length > LARGE_IMPORT_ROWS && (
          <p className="text-xs text-zinc-500">
            Cada linha vira um arquivo no repositório. Elas serão enviadas no próximo sync, em commits de até 1000 arquivos.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
