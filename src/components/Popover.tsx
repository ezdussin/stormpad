import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8
const GAP = 4

interface PopoverProps {
  /** Element the popover hangs from; clicks on it don't count as "outside", so it can act as a toggle. */
  anchor: HTMLElement
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Popover({ anchor, onClose, children, className = 'w-72' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = anchor.getBoundingClientRect()
    const { width, height } = el.getBoundingClientRect()
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - VIEWPORT_MARGIN
    el.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN))}px`
    el.style.top = `${fitsBelow ? rect.bottom + GAP : Math.max(VIEWPORT_MARGIN, rect.top - GAP - height)}px`
  })

  useEffect(() => {
    const isOutside = (target: EventTarget | null) =>
      !ref.current?.contains(target as Node) && !anchor.contains(target as Node)
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event.target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onScroll = (event: Event) => {
      if (isOutside(event.target)) onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      className={`fixed top-0 left-0 z-40 rounded-lg border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 shadow-xl shadow-black/40 ${className}`}
    >
      {children}
    </div>,
    document.body,
  )
}
