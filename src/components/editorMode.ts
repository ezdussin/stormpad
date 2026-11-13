export type EditorMode = 'rich' | 'code'

export const TOGGLE_MODE_SHORTCUT = 'Ctrl+/'

export function isToggleModeShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === '/'
}
