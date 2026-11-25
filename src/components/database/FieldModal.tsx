import { useId, useState, type FormEvent } from 'react'
import type { Field, FieldType } from '../../db/databaseTypes'
import { addField, changeFieldType, renameField } from '../../db/databases'
import { Modal } from '../Modal'
import { CREATABLE_FIELD_TYPES, FIELD_TYPES } from './fieldTypes'

interface FieldModalProps {
  schemaPath: string
  /** Omitted when creating a new field. */
  field?: Field
  onClose: () => void
}

export function FieldModal({ schemaPath, field, onClose }: FieldModalProps) {
  const formId = useId()
  const [name, setName] = useState(field?.name ?? '')
  const [type, setType] = useState<FieldType>(field?.type ?? 'text')
  const [error, setError] = useState<string | null>(null)
  const isTitle = field?.type === 'title'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!field) {
      await addField(schemaPath, name, type)
    } else {
      if (name.trim() !== field.name) await renameField(schemaPath, field.id, name)
      if (type !== field.type) await changeFieldType(schemaPath, field.id, type)
    }
    onClose()
  }

  return (
    <Modal
      title={field ? 'Editar campo' : 'Novo campo'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
            Cancelar
          </button>
          <button type="submit" form={formId} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500">
            {field ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-zinc-400">
            Nome <span className="text-zinc-600">(opcional)</span>
          </span>
          <input
            data-autofocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Sem nome"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          />
        </label>

        <div className="space-y-1">
          <span className="text-zinc-400">Tipo</span>
          {isTitle ? (
            <p className="text-xs text-zinc-500">O campo de título é sempre texto e não pode mudar de tipo.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {CREATABLE_FIELD_TYPES.map((option) => {
                const { label, icon: Icon } = FIELD_TYPES[option]
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left ${
                      type === option
                        ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                        : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <Icon size={15} className="shrink-0 text-zinc-400" /> {label}
                  </button>
                )
              })}
            </div>
          )}
          {field && !isTitle && type !== field.type && (
            <p className="pt-1 text-xs text-amber-300/80">
              Os valores existentes serão convertidos para o novo tipo; os que não puderem ser convertidos ficam vazios.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}
