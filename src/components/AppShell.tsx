import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Database,
  FileText,
  Images,
  LogOut,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { db } from '../db/db'
import { clearRepoConfig, getSetting, setSetting, type RepoConfig } from '../db/settings'
import { SyncContext } from '../sync/SyncContext'
import { useSync, type SyncState } from '../sync/useSync'
import { DatabaseSection } from './database/DatabaseSection'
import { GalleryView } from './gallery/GalleryView'
import { MemoriesView } from './memories/MemoriesView'
import { NotesShell } from './NotesShell'

type Section = 'notes' | 'memories' | 'gallery' | 'databases'

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'notes', label: 'Notas', icon: FileText },
  { id: 'memories', label: 'Lembranças', icon: MessageSquare },
  { id: 'gallery', label: 'Galeria', icon: Images },
  { id: 'databases', label: 'Bancos de dados', icon: Database },
]

function syncLabel(state: SyncState): string {
  if (state.status === 'syncing') return 'Sincronizando…'
  if (state.status === 'error') return `Falha no sync: ${state.message}`
  if (!state.lastSyncAt) return 'Não sincronizado'
  return `Sincronizado às ${new Date(state.lastSyncAt).toLocaleTimeString()}`
}

function useConflictCount(): number {
  return useLiveQuery(
    async () =>
      (await db.notes.where('syncStatus').equals('conflict').count()) +
      (await db.memories.where('syncStatus').equals('conflict').count()),
    [],
    0,
  )
}

const railButton = 'relative flex size-10 items-center justify-center rounded-lg transition-colors'

export function AppShell({ config }: { config: RepoConfig }) {
  const syncValue = useSync(config)
  const { state, sync } = syncValue
  const conflictCount = useConflictCount()
  const savedSection = useLiveQuery(async () => (await getSetting('section')) ?? null, [], 'loading' as const)
  const section: Section | null =
    savedSection === 'loading' ? null : SECTIONS.some((s) => s.id === savedSection) ? (savedSection as Section) : 'notes'

  return (
    <SyncContext.Provider value={syncValue}>
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        {conflictCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-900/60 px-4 py-2 text-sm text-amber-100">
            <AlertTriangle size={16} />
            {conflictCount} conflito(s) de sync. Revise os itens marcados em amarelo (<code>.conflict-*</code>).
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 py-3">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => void setSetting('section', id)}
                title={label}
                aria-current={section === id ? 'page' : undefined}
                className={`${railButton} ${
                  section === id ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon size={20} />
              </button>
            ))}

            <div className="mt-auto flex flex-col items-center gap-1">
              <button
                onClick={() => void sync()}
                disabled={state.status === 'syncing'}
                title={syncLabel(state)}
                className={`${railButton} text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-60`}
              >
                <RefreshCw size={18} className={state.status === 'syncing' ? 'animate-spin' : ''} />
                {state.status === 'error' && <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500" />}
              </button>
              <button
                onClick={() => void clearRepoConfig()}
                title="Desconectar"
                className={`${railButton} text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200`}
              >
                <LogOut size={18} />
              </button>
            </div>
          </nav>

          <div className="flex min-w-0 flex-1">
            {section === 'notes' && <NotesShell config={config} />}
            {section === 'memories' && <MemoriesView />}
            {section === 'gallery' && <GalleryView />}
            {section === 'databases' && <DatabaseSection />}
          </div>
        </div>
      </div>
    </SyncContext.Provider>
  )
}
