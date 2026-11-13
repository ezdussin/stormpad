import { useCallback, useState, type MouseEvent } from 'react'
import { ContextMenu, type MenuEntry, type MenuState } from './ContextMenu'

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const open = useCallback((event: MouseEvent, entries: MenuEntry[]) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, entries })
  }, [])
  const close = useCallback(() => setMenu(null), [])

  const element = menu && <ContextMenu {...menu} onClose={close} />
  return { open, element }
}
