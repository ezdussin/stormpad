export type FieldType = 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url'

export type OptionColor = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

export interface SelectOption {
  id: string
  name: string
  color: OptionColor
}

export interface Field {
  id: string
  name: string
  type: FieldType
  /** Only for `select` and `multi_select`. */
  options?: SelectOption[]
}

/**
 * Stored per type: title/text/url → string, number → number, select → option id,
 * multi_select → option ids, date → `YYYY-MM-DD`, checkbox → boolean. Missing or null means empty.
 */
export type CellValue = string | number | boolean | string[] | null

export type FilterOp =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'before'
  | 'after'
  | 'is_empty'
  | 'is_not_empty'

export interface Filter {
  id: string
  field: string
  op: FilterOp
  value: CellValue
}

export interface Sort {
  field: string
  direction: 'asc' | 'desc'
}

export interface ViewConfig {
  filters: Filter[]
  sorts: Sort[]
}

export const TITLE_FIELD_ID = 'title'
