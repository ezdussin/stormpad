import { useLiveQuery } from 'dexie-react-hooks'
import { convertValue, displayText, splitOptionNames } from '../lib/databaseQuery'
import { parseBoolean, parseDate, parseNumber, splitMultiValue } from '../lib/importFile'
import { dirOf, slugify } from '../lib/paths'
import {
  TITLE_FIELD_ID,
  type CellValue,
  type Field,
  type FieldType,
  type OptionColor,
  type SelectOption,
  type ViewConfig,
} from './databaseTypes'
import { db, type DatabaseRow, type DatabaseSchema } from './db'

type SchemaMeta = Pick<DatabaseSchema, 'id' | 'dir' | 'name' | 'icon' | 'fields' | 'view' | 'createdAt'>
type RowMeta = Pick<DatabaseRow, 'id' | 'dir' | 'values' | 'notes' | 'createdAt'>

export const OPTION_COLORS: OptionColor[] = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'brown']

const DEFAULT_TITLE_FIELD: Field = { id: TITLE_FIELD_ID, name: 'Nome', type: 'title' }

function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function parseJson(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseTimestamp(raw: unknown): number {
  const time = typeof raw === 'string' ? Date.parse(raw) : NaN
  return Number.isNaN(time) ? 0 : time
}

export function parseDatabaseSchema(path: string, content: string): SchemaMeta {
  const file = parseJson(content)
  const fields = Array.isArray(file.fields) ? (file.fields as Field[]) : []
  const view = (file.view ?? {}) as Partial<ViewConfig>
  return {
    id: typeof file.id === 'string' ? file.id : path,
    dir: dirOf(path),
    name: typeof file.name === 'string' && file.name ? file.name : 'Sem nome',
    icon: typeof file.icon === 'string' && file.icon ? file.icon : null,
    // Every database needs a title column; files edited by hand may have lost it.
    fields: fields.some((field) => field.type === 'title') ? fields : [DEFAULT_TITLE_FIELD, ...fields],
    view: {
      filters: Array.isArray(view.filters) ? view.filters : [],
      sorts: Array.isArray(view.sorts) ? view.sorts : [],
      columnWidths:
        view.columnWidths && typeof view.columnWidths === 'object' && !Array.isArray(view.columnWidths)
          ? Object.fromEntries(
              Object.entries(view.columnWidths).filter(
                (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number',
              ),
            )
          : undefined,
    },
    createdAt: parseTimestamp(file.created_at),
  }
}

export function parseDatabaseRow(path: string, content: string): RowMeta {
  const file = parseJson(content)
  return {
    id: typeof file.id === 'string' ? file.id : path,
    dir: path.slice(0, path.lastIndexOf('/rows/') + 1),
    values: file.values && typeof file.values === 'object' ? (file.values as Record<string, CellValue>) : {},
    notes: typeof file.notes === 'string' ? file.notes : '',
    createdAt: parseTimestamp(file.created_at),
  }
}

function buildSchemaContent(meta: SchemaMeta): string {
  const file = {
    id: meta.id,
    name: meta.name,
    ...(meta.icon ? { icon: meta.icon } : {}),
    created_at: new Date(meta.createdAt).toISOString(),
    fields: meta.fields,
    view: meta.view,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

function buildRowContent(meta: RowMeta): string {
  const file = {
    id: meta.id,
    created_at: new Date(meta.createdAt).toISOString(),
    values: meta.values,
    ...((meta.notes ?? '').trim() ? { notes: meta.notes } : {}),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

const schemaPathOf = (dir: string) => `${dir}schema.json`

export function useDatabases(): DatabaseSchema[] | undefined {
  return useLiveQuery(() =>
    db.databases
      .orderBy('createdAt')
      .filter((schema) => schema.syncStatus !== 'deleted')
      .toArray(),
  )
}

export function useDatabaseRows(dir: string): DatabaseRow[] | undefined {
  return useLiveQuery(
    () =>
      db.databaseRows
        .where('dir')
        .equals(dir)
        .filter((row) => row.syncStatus !== 'deleted')
        .sortBy('createdAt'),
    [dir],
  )
}

// ---- databases -------------------------------------------------------------

function newSchemaMeta(name: string, fields: Field[], now: number): SchemaMeta {
  const id = crypto.randomUUID()
  return {
    id,
    dir: `databases/${slugify(name) || 'banco'}-${id.slice(0, 8)}/`,
    name: name.trim(),
    icon: null,
    fields,
    view: { filters: [], sorts: [] },
    createdAt: now,
  }
}

export async function createDatabase(name: string): Promise<string> {
  const now = Date.now()
  const meta = newSchemaMeta(
    name,
    [DEFAULT_TITLE_FIELD, { id: `f_${shortId()}`, name: 'Tags', type: 'multi_select', options: [] }],
    now,
  )
  const path = schemaPathOf(meta.dir)
  await db.databases.add({ path, content: buildSchemaContent(meta), sha: null, updatedAt: now, syncStatus: 'dirty', ...meta })
  return path
}

export type ImportTarget = { fieldId: string } | { newField: { name: string; type: FieldType } }

export interface ImportColumn {
  /** Position of the column in each record. */
  index: number
  target: ImportTarget
}

interface ImportRequest {
  /** Existing database to append to; omit together with passing `newDatabase`. */
  schemaPath?: string
  /** Creates a database whose title column is named `titleName`. */
  newDatabase?: { name: string; titleName: string }
  columns: ImportColumn[]
  records: string[][]
  /**
   * Existing field used as a key: a record whose value in it matches an existing row (same text,
   * ignoring case) updates that row instead of creating a new one. Empty cells never clear values.
   */
  matchFieldId?: string
}

export interface ImportResult {
  schemaPath: string
  created: number
  updated: number
}

function importedValue(raw: string, field: Field, optionId: (name: string) => string): CellValue {
  const text = raw.trim()
  if (!text) return null
  switch (field.type) {
    case 'number':
      return parseNumber(text)
    case 'checkbox':
      return parseBoolean(text)
    case 'date':
      return parseDate(text)
    case 'select':
      return optionId(text)
    case 'multi_select':
      return splitMultiValue(text).map(optionId)
    default:
      return text
  }
}

/** Creates any new fields and options, then creates or updates all rows, in a single local transaction. */
export async function importRecords({
  schemaPath,
  newDatabase,
  columns,
  records,
  matchFieldId,
}: ImportRequest): Promise<ImportResult> {
  let path = schemaPath ?? ''
  let created = 0
  let updated = 0
  await db.transaction('rw', [db.databases, db.databaseRows], async () => {
    const now = Date.now()
    let meta: SchemaMeta
    let isNew = false
    if (newDatabase) {
      meta = newSchemaMeta(newDatabase.name, [{ ...DEFAULT_TITLE_FIELD, name: newDatabase.titleName || 'Nome' }], now)
      path = schemaPathOf(meta.dir)
      isNew = true
    } else {
      const existing = await db.databases.get(path)
      if (!existing) throw new Error('Banco de dados não encontrado.')
      meta = { ...existing, fields: structuredClone(existing.fields) }
    }

    const plan = columns.map(({ index, target }) => {
      if ('fieldId' in target) return { index, field: meta.fields.find((field) => field.id === target.fieldId)! }
      const field: Field = {
        id: `f_${shortId()}`,
        name: target.newField.name.trim(),
        type: target.newField.type,
        ...(isSelectType(target.newField.type) ? { options: [] } : {}),
      }
      meta.fields.push(field)
      return { index, field }
    })

    const optionIdFor = (field: Field) => (name: string) => {
      const options = (field.options ??= [])
      let option = options.find((o) => o.name.toLowerCase() === name.toLowerCase())
      if (!option) {
        option = { id: `o_${shortId()}`, name, color: OPTION_COLORS[options.length % OPTION_COLORS.length] }
        options.push(option)
      }
      return option.id
    }

    const matchField = isNew ? undefined : meta.fields.find((field) => field.id === matchFieldId)
    const keyOf = (values: Record<string, CellValue>) =>
      matchField ? displayText(values[matchField.id], matchField).trim().toLowerCase() : ''

    // Rows a key can point to: existing ones first, then rows created earlier in this same import,
    // so repeated keys in the file update the row they first created instead of duplicating it.
    const byKey = new Map<string, RowMeta>()
    const originals = new Map<RowMeta, DatabaseRow>()
    if (matchField) {
      const existingRows = await db.databaseRows.where('dir').equals(meta.dir).sortBy('createdAt')
      for (const row of existingRows) {
        const key = keyOf(row.values)
        if (row.syncStatus === 'deleted' || !key || byKey.has(key)) continue
        const working: RowMeta = {
          id: row.id,
          dir: row.dir,
          values: { ...row.values },
          notes: row.notes ?? '',
          createdAt: row.createdAt,
        }
        byKey.set(key, working)
        originals.set(working, row)
      }
    }

    const newRows: RowMeta[] = []
    for (const [i, record] of records.entries()) {
      const values: Record<string, CellValue> = {}
      for (const { index, field } of plan) {
        const value = importedValue(record[index] ?? '', field, optionIdFor(field))
        if (value !== null && !(Array.isArray(value) && value.length === 0)) values[field.id] = value
      }
      const key = keyOf(values)
      const target = key ? byKey.get(key) : undefined
      if (target) {
        // The key matched ignoring case; keep the spelling already in the database.
        delete values[matchField!.id]
        Object.assign(target.values, values)
        continue
      }
      // Consecutive timestamps keep the file's row order under the default (creation) sort.
      const rowMeta: RowMeta = { id: crypto.randomUUID(), dir: meta.dir, values, notes: '', createdAt: now + i }
      newRows.push(rowMeta)
      if (key) byKey.set(key, rowMeta)
    }

    const schemaRecord = { path, content: buildSchemaContent(meta), updatedAt: now, syncStatus: 'dirty' as const, ...meta }
    if (isNew) await db.databases.add({ ...schemaRecord, sha: null })
    else await db.databases.update(path, schemaRecord)

    await db.databaseRows.bulkAdd(
      newRows.map((rowMeta) => ({
        path: `${meta.dir}rows/${rowMeta.id}.json`,
        content: buildRowContent(rowMeta),
        sha: null,
        updatedAt: now,
        syncStatus: 'dirty' as const,
        ...rowMeta,
      })),
    )
    created = newRows.length

    for (const [working, original] of originals) {
      if (JSON.stringify(working.values) === JSON.stringify(original.values)) continue
      await db.databaseRows.update(original.path, {
        values: working.values,
        content: buildRowContent(working),
        updatedAt: now,
        syncStatus: 'dirty',
      })
      updated++
    }
  })
  return { schemaPath: path, created, updated }
}

async function updateSchema(path: string, change: (schema: SchemaMeta) => SchemaMeta): Promise<void> {
  await db.transaction('rw', db.databases, async () => {
    const schema = await db.databases.get(path)
    if (!schema) return
    const meta = change(schema)
    await db.databases.update(path, { ...meta, content: buildSchemaContent(meta), updatedAt: Date.now(), syncStatus: 'dirty' })
  })
}

export function renameDatabase(path: string, name: string): Promise<void> {
  return updateSchema(path, (schema) => ({ ...schema, name: name.trim() }))
}

export function setDatabaseIcon(path: string, icon: string | null): Promise<void> {
  return updateSchema(path, (schema) => ({ ...schema, icon }))
}

export async function deleteDatabase(path: string): Promise<void> {
  await db.transaction('rw', [db.databases, db.databaseRows], async () => {
    const schema = await db.databases.get(path)
    if (!schema) return
    const rows = await db.databaseRows.where('dir').equals(schema.dir).toArray()
    const now = Date.now()
    for (const file of [schema, ...rows]) {
      const table = file === schema ? db.databases : db.databaseRows
      if (file.sha === null) await table.delete(file.path)
      else await table.update(file.path, { syncStatus: 'deleted', updatedAt: now })
    }
  })
}

export function setViewConfig(path: string, change: (view: ViewConfig) => ViewConfig): Promise<void> {
  return updateSchema(path, (schema) => ({ ...schema, view: change(schema.view) }))
}

// ---- fields ----------------------------------------------------------------

export async function addField(path: string, name: string, type: FieldType): Promise<void> {
  const field: Field = { id: `f_${shortId()}`, name: name.trim(), type, ...(isSelectType(type) ? { options: [] } : {}) }
  await updateSchema(path, (schema) => ({ ...schema, fields: [...schema.fields, field] }))
}

export function renameField(path: string, fieldId: string, name: string): Promise<void> {
  return updateSchema(path, (schema) => ({
    ...schema,
    fields: schema.fields.map((field) => (field.id === fieldId ? { ...field, name: name.trim() } : field)),
  }))
}

// Row values of the removed field are left in place and dropped the next time each row is saved.
export function deleteField(path: string, fieldId: string): Promise<void> {
  return updateSchema(path, (schema) => {
    const columnWidths = { ...schema.view.columnWidths }
    delete columnWidths[fieldId]
    return {
      ...schema,
      fields: schema.fields.filter((field) => field.id !== fieldId),
      view: {
        filters: schema.view.filters.filter((filter) => filter.field !== fieldId),
        sorts: schema.view.sorts.filter((sort) => sort.field !== fieldId),
        columnWidths: Object.keys(columnWidths).length ? columnWidths : undefined,
      },
    }
  })
}

/** Moves a field left (-1) or right (+1). */
export function moveField(path: string, fieldId: string, delta: -1 | 1): Promise<void> {
  return updateSchema(path, (schema) => {
    const fields = [...schema.fields]
    const from = fields.findIndex((field) => field.id === fieldId)
    const to = from + delta
    if (from < 0 || to < 0 || to >= fields.length) return schema
    ;[fields[from], fields[to]] = [fields[to], fields[from]]
    return { ...schema, fields }
  })
}

/** Reorders a field to `toIndex`. */
export function reorderField(path: string, fieldId: string, toIndex: number): Promise<void> {
  return updateSchema(path, (schema) => {
    const fields = [...schema.fields]
    const from = fields.findIndex((field) => field.id === fieldId)
    if (from < 0 || toIndex < 0 || toIndex >= fields.length || from === toIndex) return schema
    const [item] = fields.splice(from, 1)
    fields.splice(toIndex, 0, item)
    return { ...schema, fields }
  })
}

export function setColumnWidth(path: string, fieldId: string, width: number): Promise<void> {
  return setViewConfig(path, (view) => ({
    ...view,
    columnWidths: { ...view.columnWidths, [fieldId]: width },
  }))
}

function isSelectType(type: FieldType): boolean {
  return type === 'select' || type === 'multi_select'
}

/** Changes the type and rewrites only the rows whose value actually changes. */
export async function changeFieldType(path: string, fieldId: string, type: FieldType): Promise<void> {
  await db.transaction('rw', [db.databases, db.databaseRows], async () => {
    const schema = await db.databases.get(path)
    const from = schema?.fields.find((field) => field.id === fieldId)
    if (!schema || !from || from.type === type || from.type === 'title' || type === 'title') return

    const rows = await db.databaseRows.where('dir').equals(schema.dir).toArray()
    const to: Field = { id: from.id, name: from.name, type }
    if (isSelectType(type)) {
      const options = [...(from.options ?? [])]
      const known = new Set(options.map((option) => option.name.toLowerCase()))
      for (const row of rows) {
        for (const name of splitOptionNames(displayText(row.values[fieldId], from))) {
          if (known.has(name.toLowerCase())) continue
          known.add(name.toLowerCase())
          options.push({ id: `o_${shortId()}`, name, color: OPTION_COLORS[options.length % OPTION_COLORS.length] })
        }
      }
      to.options = options
    }

    const now = Date.now()
    for (const row of rows) {
      const before = row.values[fieldId]
      if (before === undefined || before === null) continue
      const after = convertValue(before, from, to)
      if (JSON.stringify(after) === JSON.stringify(before)) continue
      const meta = { ...row, values: { ...row.values, [fieldId]: after } }
      await db.databaseRows.update(row.path, {
        values: meta.values,
        content: buildRowContent(meta),
        updatedAt: now,
        syncStatus: row.syncStatus === 'deleted' ? 'deleted' : 'dirty',
      })
    }

    const meta: SchemaMeta = { ...schema, fields: schema.fields.map((field) => (field.id === fieldId ? to : field)) }
    meta.view = {
      // Filter operators and values depend on the type, so filters on this field no longer make sense.
      filters: schema.view.filters.filter((filter) => filter.field !== fieldId),
      sorts: schema.view.sorts,
    }
    await db.databases.update(path, { ...meta, content: buildSchemaContent(meta), updatedAt: now, syncStatus: 'dirty' })
  })
}

export async function addOption(path: string, fieldId: string, name: string): Promise<string> {
  const id = `o_${shortId()}`
  await updateSchema(path, (schema) => ({
    ...schema,
    fields: schema.fields.map((field) => {
      if (field.id !== fieldId) return field
      const options = field.options ?? []
      const option: SelectOption = { id, name: name.trim(), color: OPTION_COLORS[options.length % OPTION_COLORS.length] }
      return { ...field, options: [...options, option] }
    }),
  }))
  return id
}

export function deleteOption(path: string, fieldId: string, optionId: string): Promise<void> {
  return updateSchema(path, (schema) => ({
    ...schema,
    fields: schema.fields.map((field) =>
      field.id === fieldId ? { ...field, options: (field.options ?? []).filter((option) => option.id !== optionId) } : field,
    ),
    view: {
      ...schema.view,
      filters: schema.view.filters.filter((filter) => !(filter.field === fieldId && filter.value === optionId)),
    },
  }))
}

export function updateOptionColor(
  path: string,
  fieldId: string,
  optionId: string,
  color: OptionColor,
): Promise<void> {
  return updateSchema(path, (schema) => ({
    ...schema,
    fields: schema.fields.map((field) => {
      if (field.id !== fieldId) return field
      return {
        ...field,
        options: (field.options ?? []).map((option) => (option.id === optionId ? { ...option, color } : option)),
      }
    }),
  }))
}

// ---- rows ------------------------------------------------------------------

export async function addRow(
  dir: string,
  values: Record<string, CellValue> = {},
  notes = '',
): Promise<string> {
  const now = new Date()
  const meta: RowMeta = { id: crypto.randomUUID(), dir, values, notes, createdAt: now.getTime() }
  const path = `${dir}rows/${meta.id}.json`
  await db.databaseRows.add({
    path,
    content: buildRowContent(meta),
    sha: null,
    updatedAt: now.getTime(),
    syncStatus: 'dirty',
    ...meta,
  })
  return path
}

export async function setRowValue(path: string, fieldId: string, value: CellValue): Promise<void> {
  await db.transaction('rw', [db.databases, db.databaseRows], async () => {
    const row = await db.databaseRows.get(path)
    if (!row || row.syncStatus === 'deleted') return
    const schema = await db.databases.get(schemaPathOf(row.dir))
    const fieldIds = new Set(schema?.fields.map((field) => field.id) ?? Object.keys(row.values))
    const values = Object.fromEntries(
      Object.entries({ ...row.values, [fieldId]: value }).filter(([id, v]) => fieldIds.has(id) && v !== null),
    )
    const meta: RowMeta = { ...row, values, notes: row.notes ?? '' }
    await db.databaseRows.update(path, { values, content: buildRowContent(meta), updatedAt: Date.now(), syncStatus: 'dirty' })
  })
}

export async function setRowNotes(path: string, notes: string): Promise<void> {
  await db.transaction('rw', db.databaseRows, async () => {
    const row = await db.databaseRows.get(path)
    if (!row || row.syncStatus === 'deleted') return
    const meta: RowMeta = { ...row, notes, values: row.values }
    await db.databaseRows.update(path, {
      notes,
      content: buildRowContent(meta),
      updatedAt: Date.now(),
      syncStatus: 'dirty',
    })
  })
}

export async function duplicateRow(path: string): Promise<string | null> {
  const row = await db.databaseRows.get(path)
  return row ? addRow(row.dir, structuredClone(row.values), row.notes ?? '') : null
}

export async function deleteRows(paths: string[]): Promise<void> {
  await db.transaction('rw', db.databaseRows, async () => {
    for (const path of paths) await deleteRow(path)
  })
}

export async function deleteRow(path: string): Promise<void> {
  const row = await db.databaseRows.get(path)
  if (!row) return
  if (row.sha === null) await db.databaseRows.delete(path)
  else await db.databaseRows.update(path, { syncStatus: 'deleted', updatedAt: Date.now() })
}
