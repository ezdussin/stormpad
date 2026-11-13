import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SIZE_CLASSES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
}

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof SIZE_CLASSES
}

// Native <dialog> + showModal() gives focus trapping, Escape handling and focus restore for free.
// showModal() focuses the first focusable element (the close button); `data-autofocus` overrides that.
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    const target = dialog.querySelector<HTMLElement>('[data-autofocus]')
    target?.focus()
    if (target instanceof HTMLInputElement) target.select()
  }, [])

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`m-auto w-full ${SIZE_CLASSES[size]} rounded-lg border border-zinc-800 bg-zinc-900 p-0 text-zinc-100 shadow-2xl shadow-black/50 backdrop:bg-black/60`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button onClick={onClose} title="Fechar" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
          <X size={16} />
        </button>
      </div>
      <div className="px-4 py-3 text-sm">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">{footer}</div>}
    </dialog>,
    document.body,
  )
}

interface ConfirmDialogProps {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message}
    </Modal>
  )
}
