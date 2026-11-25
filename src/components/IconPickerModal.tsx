import { useMemo, useState } from 'react'
import {
  APP_ICON_IDS,
  DEFAULT_DATABASE_ICON,
  DEFAULT_NOTE_ICON,
  resolveAppIcon,
  type AppIconId,
} from '../lib/appIcons'
import { Modal } from './Modal'

interface IconPickerModalProps {
  title?: string
  value: string | null
  fallback: 'note' | 'database'
  onSelect: (icon: AppIconId | null) => void
  onClose: () => void
}

export function IconPickerModal({
  title = 'Escolher ícone',
  value,
  fallback,
  onSelect,
  onClose,
}: IconPickerModalProps) {
  const [query, setQuery] = useState('')
  const defaultId = fallback === 'note' ? DEFAULT_NOTE_ICON : DEFAULT_DATABASE_ICON
  const selected = value && APP_ICON_IDS.includes(value as AppIconId) ? (value as AppIconId) : null

  const icons = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? APP_ICON_IDS.filter((id) => id.includes(q)) : APP_ICON_IDS
  }, [query])

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div className="space-y-3">
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ícone…"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        />
        <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
          <button
            type="button"
            title="Padrão"
            onClick={() => {
              onSelect(null)
              onClose()
            }}
            className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200 ${
              selected === null ? 'border-sky-500 bg-sky-500/10 text-sky-200' : 'border-zinc-800'
            }`}
          >
            {(() => {
              const Icon = resolveAppIcon(null, defaultId)
              return <Icon size={18} />
            })()}
            Padrão
          </button>
          {icons.map((id) => {
            const Icon = resolveAppIcon(id, defaultId)
            return (
              <button
                key={id}
                type="button"
                title={id}
                onClick={() => {
                  onSelect(id)
                  onClose()
                }}
                className={`flex items-center justify-center rounded-md border p-2.5 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 ${
                  selected === id ? 'border-sky-500 bg-sky-500/10 text-sky-100' : 'border-zinc-800'
                }`}
              >
                <Icon size={18} />
              </button>
            )
          })}
        </div>
        {icons.length === 0 && <p className="text-center text-sm text-zinc-500">Nenhum ícone encontrado.</p>}
      </div>
    </Modal>
  )
}
