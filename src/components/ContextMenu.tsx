import type { LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void | Promise<void>
}

export type MenuEntry = MenuItem | 'separator'

export interface MenuState {
  x: number
  y: number
  entries: MenuEntry[]
}

const VIEWPORT_MARGIN = 4

export function ContextMenu({ x, y, entries, onClose }: MenuState & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN))}px`
    el.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN))}px`
  }, [x, y])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
      previousFocus?.focus()
    }
  }, [onClose])

  function handleKeyDown(event: KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }
    if (event.key in next) {
      event.preventDefault()
      items[next[event.key]].focus()
    }
  }

  function select(item: MenuItem) {
    onClose()
    Promise.resolve(item.onSelect()).catch((error: unknown) => console.error(error))
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: x, top: y }}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 min-w-52 rounded-md border border-zinc-700 bg-zinc-900 p-1 text-sm text-zinc-100 shadow-xl shadow-black/40"
    >
      {entries.map((entry, i) =>
        entry === 'separator' ? (
          <div key={i} role="separator" className="my-1 h-px bg-zinc-800" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => select(entry)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left outline-none hover:bg-zinc-800 focus:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40 ${
              entry.danger ? 'text-red-400' : ''
            }`}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              {entry.icon && <entry.icon size={15} />}
            </span>
            <span className="flex-1">{entry.label}</span>
            {entry.shortcut && <span className="text-xs text-zinc-500">{entry.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
