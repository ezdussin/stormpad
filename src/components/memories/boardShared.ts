export const MEMORY_DRAG_TYPE = 'application/x-stormpad-memory'

const MAX_TEXTAREA_ROWS = 8

export function rowsFor(text: string): number {
  return Math.min(MAX_TEXTAREA_ROWS, text.split('\n').length)
}
