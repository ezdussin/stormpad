import { useLiveQuery } from 'dexie-react-hooks'
import { TITLE_FIELD_ID } from '../../db/databaseTypes'
import { db, type DatabaseSchema } from '../../db/db'
import { setRowNotes } from '../../db/databases'
import { MarkdownBodyEditor } from '../MarkdownBodyEditor'
import { SideDrawer } from '../SideDrawer'
import { Cell } from './Cell'
import { FIELD_TYPES } from './fieldTypes'

interface RowDetailDrawerProps {
  schema: DatabaseSchema
  rowPath: string
  onClose: () => void
  /** When true, the title cell opens already in edit mode (new / duplicated rows). */
  focusTitle?: boolean
}

export function RowDetailDrawer({ schema, rowPath, onClose, focusTitle = false }: RowDetailDrawerProps) {
  const row = useLiveQuery(() => db.databaseRows.get(rowPath), [rowPath])

  if (!row || row.syncStatus === 'deleted') {
    return (
      <SideDrawer title="Linha" onClose={onClose}>
        <p className="p-4 text-sm text-zinc-500">Esta linha não existe mais.</p>
      </SideDrawer>
    )
  }

  const titleField = schema.fields.find((field) => field.type === 'title') ?? schema.fields[0]
  const titleValue = titleField ? row.values[titleField.id] : null
  const title =
    typeof titleValue === 'string' && titleValue.trim()
      ? titleValue.trim()
      : titleField?.id === TITLE_FIELD_ID
        ? 'Sem título'
        : 'Linha'

  return (
    <SideDrawer title={title} subtitle={schema.name} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <section className="shrink-0 space-y-3 border-b border-zinc-800 px-4 py-4">
          <h3 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Propriedades</h3>
          <div className="space-y-3">
            {schema.fields.map((field) => {
              const { icon: Icon } = FIELD_TYPES[field.type]
              return (
                <div key={field.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2">
                  <div className="flex items-center gap-1.5 pt-2 text-xs text-zinc-500">
                    <Icon size={13} className="shrink-0" />
                    <span className={`truncate ${field.name.trim() ? '' : 'italic text-zinc-600'}`}>
                      {field.name.trim() || 'Sem nome'}
                    </span>
                  </div>
                  <div className="min-w-0 rounded-md border border-zinc-800 bg-zinc-900/50">
                    <Cell
                      schemaPath={schema.path}
                      field={field}
                      row={row}
                      autoEdit={focusTitle && field.type === 'title'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="relative flex min-h-0 flex-1 flex-col px-4 py-4">
          <h3 className="mb-2 shrink-0 text-xs font-medium tracking-wide text-zinc-500 uppercase">Notas</h3>
          <MarkdownBodyEditor
            documentKey={row.path}
            markdown={row.notes ?? ''}
            onChange={(notes) => void setRowNotes(row.path, notes)}
            placeholder="Escreva notas em Markdown…"
          />
        </section>
      </div>
    </SideDrawer>
  )
}
