import type { FieldType } from '../db/databaseTypes'

export interface ImportTable {
  headers: string[]
  records: string[][]
}

export type ImportFormat = 'csv' | 'json'

export const CSV_DELIMITERS = [
  { value: ',', label: 'Vírgula (,)' },
  { value: ';', label: 'Ponto e vírgula (;)' },
  { value: '\t', label: 'Tabulação' },
  { value: '|', label: 'Barra vertical (|)' },
]

export function formatOf(file: File): ImportFormat | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json') || file.type === 'application/json') return 'json'
  if (/\.(csv|tsv|txt)$/.test(name) || file.type === 'text/csv') return 'csv'
  return null
}

// Excel on Windows (especially in pt-BR) still saves CSV as Windows-1252, which isn't valid UTF-8.
export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer)
  }
  return text.replace(/^\uFEFF/, '')
}

export interface LoadedFile {
  name: string
  text: string
  format: ImportFormat
  /** Detected separator; only meaningful for CSV. */
  delimiter: string
}

export async function loadImportFile(file: File): Promise<LoadedFile> {
  const format = formatOf(file)
  if (!format) throw new Error('Formato não suportado. Use CSV, TSV ou JSON.')
  const text = await readTextFile(file)
  const delimiter = file.name.toLowerCase().endsWith('.tsv') ? '\t' : detectDelimiter(text)
  return { name: file.name, text, format, delimiter }
}

export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/))
  let best = ','
  let bestCount = 0
  for (const { value } of CSV_DELIMITERS) {
    const count = firstLine.split(value).length - 1
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/** RFC 4180: quoted fields may contain the delimiter, line breaks and `""` escaped quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char !== '"') field += char
      else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else quoted = false
    } else if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function uniqueHeaders(raw: string[], width: number): string[] {
  const seen = new Map<string, number>()
  return Array.from({ length: width }, (_, i) => {
    const base = raw[i]?.trim() || `Coluna ${i + 1}`
    const count = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), count)
    return count === 1 ? base : `${base} (${count})`
  })
}

export function tableFromCsv(text: string, delimiter: string, hasHeader: boolean): ImportTable {
  const rows = parseCsv(text, delimiter)
  const width = Math.max(0, ...rows.map((row) => row.length))
  const headers = uniqueHeaders(hasHeader ? (rows[0] ?? []) : [], width)
  const records = (hasHeader ? rows.slice(1) : rows).map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ''))
  return { headers, records }
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(stringify).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Accepts an array of objects, or an object holding one (e.g. `{ "items": [...] }`). */
export function tableFromJson(text: string): ImportTable {
  const parsed: unknown = JSON.parse(text)
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? Object.values(parsed).find(Array.isArray)
      : undefined
  if (!list) throw new Error('O JSON precisa ser uma lista de objetos.')

  const objects = list.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item : { Valor: item }))
  const keys: string[] = []
  for (const object of objects) {
    for (const key of Object.keys(object)) if (!keys.includes(key)) keys.push(key)
  }
  return {
    headers: uniqueHeaders(keys, keys.length),
    records: objects.map((object) => keys.map((key) => stringify((object as Record<string, unknown>)[key]))),
  }
}

// ---- value parsing ---------------------------------------------------------

const TRUE_WORDS = new Set(['true', 'sim', 'yes', 'x', 'verdadeiro', '✓', '✔'])
const FALSE_WORDS = new Set(['false', 'não', 'nao', 'no', 'falso'])

export function parseBoolean(raw: string): boolean | null {
  const word = raw.trim().toLowerCase()
  if (TRUE_WORDS.has(word)) return true
  if (FALSE_WORDS.has(word)) return false
  return null
}

/**
 * Accepts `1234.5`, `1.234,5` and `1,234.5` (the last separator is the decimal one). A lone comma is read
 * as decimal (`3,5` → 3.5) since that's how pt-BR spreadsheets export numbers.
 */
export function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '')
  if (!/^[-+]?(\d|[.,]\d)[\d.,]*$/.test(text)) return null
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  let normalized = text
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (lastComma !== -1) {
    normalized = /^[-+]?\d{1,3}(,\d{3}){2,}$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.')
  } else if (/^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
    normalized = text.replace(/\./g, '')
  }
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

/** `YYYY-MM-DD` (optionally followed by a time) or `DD/MM/YYYY`, returned as `YYYY-MM-DD`. */
export function parseDate(raw: string): string | null {
  const text = raw.trim()
  let year: string, month: string, day: string
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  const local = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (iso) [, year, month, day] = iso
  else if (local) [, day, month, year] = local
  else return null
  const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null
}

export function splitMultiValue(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const MAX_SELECT_OPTIONS = 12
const MAX_SELECT_LENGTH = 40

export function inferFieldType(values: string[]): FieldType {
  const filled = values.map((value) => value.trim()).filter(Boolean)
  if (filled.length === 0) return 'text'
  if (filled.every((value) => parseNumber(value) !== null)) return 'number'
  if (filled.every((value) => parseBoolean(value) !== null)) return 'checkbox'
  if (filled.every((value) => parseDate(value) !== null)) return 'date'
  if (filled.every((value) => /^https?:\/\/\S+$/i.test(value))) return 'url'
  const distinct = new Set(filled.map((value) => value.toLowerCase()))
  const repeats = distinct.size < filled.length * 0.6
  if (repeats && distinct.size <= MAX_SELECT_OPTIONS && filled.every((value) => value.length <= MAX_SELECT_LENGTH)) {
    return 'select'
  }
  return 'text'
}
