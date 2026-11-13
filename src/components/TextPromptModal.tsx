import { useId, useState, type FormEvent } from 'react'
import { Modal } from './Modal'

interface TextPromptModalProps {
  title: string
  label: string
  submitLabel: string
  initialValue?: string
  onSubmit: (value: string) => void | Promise<void>
  onClose: () => void
}

export function TextPromptModal({ title, label, submitLabel, initialValue = '', onSubmit, onClose }: TextPromptModalProps) {
  const formId = useId()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return setError('Informe um nome.')
    try {
      await onSubmit(value.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
            Cancelar
          </button>
          <button type="submit" form={formId} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500">
            {submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-zinc-400">{label}</span>
          <input
            data-autofocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}
