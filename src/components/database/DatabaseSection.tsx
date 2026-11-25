import { Database, FileUp, Pencil, Plus, Smile, Trash2 } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import type { DatabaseSchema } from '../../db/db'
import { createDatabase, deleteDatabase, renameDatabase, setDatabaseIcon, useDatabases } from '../../db/databases'
import { DEFAULT_DATABASE_ICON, resolveAppIcon, type AppIconId } from '../../lib/appIcons'
import { IconPickerModal } from '../IconPickerModal'
import { ConfirmDialog } from '../Modal'
import { TextPromptModal } from '../TextPromptModal'
import { useContextMenu } from '../useContextMenu'
import { DatabaseTable } from './DatabaseTable'
import { ImportModal } from './ImportModal'

export function DatabaseSection() {
  const databases = useDatabases()
  const menu = useContextMenu()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [renaming, setRenaming] = useState<DatabaseSchema | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DatabaseSchema | null>(null)
  const [iconTarget, setIconTarget] = useState<DatabaseSchema | null>(null)
  const selected = databases?.find((schema) => schema.path === selectedPath) ?? databases?.[0] ?? null

  function openMenu(event: MouseEvent, schema: DatabaseSchema) {
    menu.open(event, [
      { label: 'Renomear', icon: Pencil, onSelect: () => setRenaming(schema) },
      { label: 'Alterar ícone', icon: Smile, onSelect: () => setIconTarget(schema) },
      'separator',
      { label: 'Excluir banco', icon: Trash2, danger: true, onSelect: () => setPendingDelete(schema) },
    ])
  }

  return (
    <div className="flex min-w-0 flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-2">
          <span className="flex-1 text-sm font-semibold">Bancos de dados</span>
          <button
            onClick={() => setImporting(true)}
            title="Importar arquivo (CSV, TSV ou JSON)"
            className="rounded-md p-1.5 hover:bg-zinc-800"
          >
            <FileUp size={17} />
          </button>
          <button onClick={() => setCreating(true)} title="Novo banco de dados" className="rounded-md p-1.5 hover:bg-zinc-800">
            <Plus size={18} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto py-1">
          {databases?.map((schema) => {
            const SchemaIcon = resolveAppIcon(schema.icon, DEFAULT_DATABASE_ICON)
            return (
              <li key={schema.path}>
                <button
                  onClick={() => setSelectedPath(schema.path)}
                  onContextMenu={(e) => openMenu(e, schema)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-900 ${
                    schema.path === selected?.path ? 'bg-zinc-900 text-zinc-50' : 'text-zinc-300'
                  }`}
                >
                  <SchemaIcon size={15} className="shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate">{schema.name}</span>
                  {schema.syncStatus !== 'synced' && (
                    <span title="Ainda não enviado" className="size-2 shrink-0 rounded-full bg-sky-400" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {selected ? (
        <DatabaseTable key={selected.path} schema={selected} />
      ) : (
        databases && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
            <Database size={32} className="text-zinc-700" />
            Nenhum banco de dados ainda.
            <div className="flex gap-2">
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 font-medium text-zinc-100 hover:bg-sky-500"
              >
                <Plus size={16} /> Criar banco de dados
              </button>
              <button
                onClick={() => setImporting(true)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
              >
                <FileUp size={16} /> Importar arquivo
              </button>
            </div>
          </div>
        )
      )}

      {menu.element}
      {creating && (
        <TextPromptModal
          title="Novo banco de dados"
          label="Nome"
          submitLabel="Criar"
          onSubmit={async (name) => setSelectedPath(await createDatabase(name))}
          onClose={() => setCreating(false)}
        />
      )}
      {importing && <ImportModal onImported={setSelectedPath} onClose={() => setImporting(false)} />}
      {renaming && (
        <TextPromptModal
          title="Renomear banco de dados"
          label="Nome"
          submitLabel="Renomear"
          initialValue={renaming.name}
          onSubmit={(name) => renameDatabase(renaming.path, name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Excluir banco de dados"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir <strong className="text-zinc-100">{pendingDelete.name}</strong> e todas as suas linhas? Os arquivos também
              serão removidos do GitHub no próximo sync.
            </p>
          }
          onConfirm={() => {
            void deleteDatabase(pendingDelete.path)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {iconTarget && (
        <IconPickerModal
          value={iconTarget.icon}
          fallback="database"
          onSelect={(icon: AppIconId | null) => void setDatabaseIcon(iconTarget.path, icon)}
          onClose={() => setIconTarget(null)}
        />
      )}
    </div>
  )
}
