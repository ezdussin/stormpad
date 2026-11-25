import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SideDrawerProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Optional subtitle under the title (e.g. field count). */
  subtitle?: ReactNode
}

/** Right-side detail panel on large screens; nearly full-width sheet on small ones. */
export function SideDrawer({ title, subtitle, onClose, children }: SideDrawerProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // Nested overlays (popover / native dialog) own Escape first.
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-full flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/50 sm:max-w-md lg:max-w-xl xl:max-w-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
