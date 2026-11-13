import type { DatabaseRow, DatabaseSchema } from '../db/db'
import type { CellValue, Field, FieldType, Filter, FilterOp, SelectOption } from '../db/databaseTypes'

export const FILTER_OPS: Record<FieldType, FilterOp[]> = {
  title: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  text: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  url: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  number: ['is', 'is_not', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  date: ['is', 'before', 'after', 'is_empty', 'is_not_empty'],
  checkbox: ['is'],
}

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  contains: 'contém',
  not_contains: 'não contém',
  is: 'é',
  is_not: 'não é',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  before: 'antes de',
  after: 'depois de',
  is_empty: 'está vazio',
  is_not_empty: 'não está vazio',
}

export function opNeedsValue(op: FilterOp): boolean {
  return op !== 'is_empty' && op !== 'is_not_empty'
}

function optionsById(field: Field): Map<string, SelectOption> {
  return new Map((field.options ?? []).map((option) => [option.id, option]))
}

export function selectedOptions(value: CellValue, field: Field): SelectOption[] {
  const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const byId = optionsById(field)
  return ids.flatMap((id) => byId.get(id) ?? [])
}

export function isEmptyValue(value: CellValue | undefined, field: Field): boolean {
  if (value === null || value === undefined || value === '') return true
  if (field.type === 'checkbox') return value !== true
  if (field.type === 'select' || field.type === 'multi_select') return selectedOptions(value, field).length === 0
  return Array.isArray(value) && value.length === 0
}

/** Plain-text rendering of any value, used for search-like filters, copying and type conversion. */
export function displayText(value: CellValue | undefined, field: Field): string {
  if (value === null || value === undefined) return ''
  switch (field.type) {
    case 'select':
    case 'multi_select':
      return selectedOptions(value, field)
        .map((option) => option.name)
        .join(', ')
    case 'checkbox':
      return value === true ? 'Sim' : ''
    case 'number':
      return typeof value === 'number' ? String(value) : ''
    default:
      return Array.isArray(value) ? value.join(', ') : String(value)
  }
}

function matchesFilter(row: DatabaseRow, filter: Filter, field: Field): boolean {
  const value = row.values[field.id]
  if (filter.op === 'is_empty') return isEmptyValue(value, field)
  if (filter.op === 'is_not_empty') return !isEmptyValue(value, field)
  // An unfinished filter (no value chosen yet) doesn't hide anything.
  if (filter.value === null || filter.value === '') return true

  switch (field.type) {
    case 'number': {
      if (typeof value !== 'number') return filter.op === 'is_not'
      const target = Number(filter.value)
      return {
        is: value === target,
        is_not: value !== target,
        gt: value > target,
        lt: value < target,
        gte: value >= target,
        lte: value <= target,
      }[filter.op as 'is' | 'is_not' | 'gt' | 'lt' | 'gte' | 'lte']
    }
    case 'select': {
      const selected = typeof value === 'string' ? value : null
      return filter.op === 'is' ? selected === filter.value : selected !== filter.value
    }
    case 'multi_select': {
      const has = Array.isArray(value) && value.includes(String(filter.value))
      return filter.op === 'contains' ? has : !has
    }
    case 'date': {
      if (typeof value !== 'string' || !value) return false
      const target = String(filter.value)
      if (filter.op === 'before') return value < target
      if (filter.op === 'after') return value > target
      return value === target
    }
    case 'checkbox':
      return (value === true) === (filter.value === true)
    default: {
      const text = displayText(value, field).toLowerCase()
      const target = String(filter.value).toLowerCase()
      return {
        contains: text.includes(target),
        not_contains: !text.includes(target),
        is: text === target,
        is_not: text !== target,
      }[filter.op as 'contains' | 'not_contains' | 'is' | 'is_not']
    }
  }
}

function compareValues(a: CellValue | undefined, b: CellValue | undefined, field: Field): number {
  switch (field.type) {
    case 'number':
      return Number(a) - Number(b)
    case 'checkbox':
      return Number(a === true) - Number(b === true)
    case 'select': {
      const order = (field.options ?? []).map((option) => option.id)
      return order.indexOf(String(a)) - order.indexOf(String(b))
    }
    default:
      return displayText(a, field).localeCompare(displayText(b, field), undefined, { numeric: true })
  }
}

/** Rows matching every filter, ordered by the sorts in priority order (creation date as tiebreaker). */
export function applyView(rows: DatabaseRow[], schema: DatabaseSchema): DatabaseRow[] {
  const fields = new Map(schema.fields.map((field) => [field.id, field]))
  const filters = schema.view.filters.filter((filter) => fields.has(filter.field))
  const sorts = schema.view.sorts.filter((sort) => fields.has(sort.field))

  return rows
    .filter((row) => filters.every((filter) => matchesFilter(row, filter, fields.get(filter.field)!)))
    .sort((a, b) => {
      for (const sort of sorts) {
        const field = fields.get(sort.field)!
        const aEmpty = isEmptyValue(a.values[field.id], field)
        const bEmpty = isEmptyValue(b.values[field.id], field)
        // Empty cells stay at the bottom in both directions, like Notion.
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
        if (aEmpty) continue
        const result = compareValues(a.values[field.id], b.values[field.id], field)
        if (result !== 0) return sort.direction === 'asc' ? result : -result
      }
      return a.createdAt - b.createdAt
    })
}

/** Lowercase without accents, so "acao" finds "Ação". */
function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Keeps rows where any column's text contains the query. Rows matching in a column further left come
 * first; within the same column the incoming order (the view's sort) is preserved.
 */
export function searchRows(rows: DatabaseRow[], fields: Field[], query: string): DatabaseRow[] {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return rows
  return rows
    .map((row) => ({
      row,
      column: fields.findIndex((field) => normalizeForSearch(displayText(row.values[field.id], field)).includes(needle)),
    }))
    .filter(({ column }) => column !== -1)
    .sort((a, b) => a.column - b.column)
    .map(({ row }) => row)
}

const TRUTHY = new Set(['true', 'sim', 'yes', 'x', '1', 'v'])

/** Converts a value when its field changes type; `to.options` must already contain options for every name. */
export function convertValue(value: CellValue | undefined, from: Field, to: Field): CellValue {
  if (from.type === to.type) return value ?? null
  const text = displayText(value, from).trim()

  switch (to.type) {
    case 'title':
    case 'text':
    case 'url':
      return text || null
    case 'number': {
      const number = Number(text.replace(',', '.'))
      return text && Number.isFinite(number) ? number : null
    }
    case 'checkbox':
      return TRUTHY.has(text.toLowerCase())
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
    case 'select':
    case 'multi_select': {
      const byName = new Map((to.options ?? []).map((option) => [option.name.toLowerCase(), option.id]))
      const ids = splitOptionNames(text).flatMap((name) => byName.get(name.toLowerCase()) ?? [])
      return to.type === 'select' ? (ids[0] ?? null) : ids
    }
  }
}

export function splitOptionNames(text: string): string[] {
  return text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}
