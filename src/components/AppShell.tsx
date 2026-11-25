import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  CloudOff,
  Database,
  FileText,
  Images,
  LogOut,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearRepoConfig, getSetting, setSetting, type RepoConfig } from '../db/settings'
import { SyncContext } from '../sync/SyncContext'
import { usePendingSync } from '../sync/usePendingSync'
import { useSync, type SyncState } from '../sync/useSync'
import { DatabaseSection } from './database/DatabaseSection'
import { GalleryView } from './gallery/GalleryView'
import { MemoriesView } from './memories/MemoriesView'
import { ConfirmDialog } from './Modal'
import { NotesShell } from './NotesShell'

type Section = 'notes' | 'memories' | 'gallery' | 'databases'

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'notes', label: 'Notas', icon: FileText },
  { id: 'memories', label: 'Lembranças', icon: MessageSquare },
  { id: 'gallery', label: 'Galeria', icon: Images },
  { id: 'databases', label: 'Bancos de dados', icon: Database },
]

function syncLabel(state: SyncState, pending: number, conflicts: number, online: boolean): string {
  if (state.status === 'syncing') return 'Sincronizando…'
  if (state.status === 'error') return `Falha no sync: ${state.message}`
  if (!online) return 'Sem conexão'
  if (conflicts > 0) return `${conflicts} conflito(s) — revise os itens marcados`
  if (pending > 0) return `${pending} alteração(ões) aguardando sync`
  if (!state.lastSyncAt) return 'Ainda não sincronizado — clique para sincronizar'
  return `Tudo sincronizado · ${new Date(state.lastSyncAt).toLocaleTimeString()}`
}

const railButton = 'relative flex size-10 items-center justify-center rounded-lg transition-colors'

function isSyncShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's'
}

export function AppShell({ config }: { config: RepoConfig }) {
  const syncValue = useSync(config)
  const { state, sync, syncBlocked } = syncValue
  const pending = usePendingSync()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const savedSection = useLiveQuery(async () => (await getSetting('section')) ?? null, [], 'loading' as const)
  const section: Section | null =
    savedSection === 'loading' ? null : SECTIONS.some((s) => s.id === savedSection) ? (savedSection as Section) : 'notes'

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSyncShortcut(event)) return
      event.preventDefault()
      void sync()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sync])

  const fullySynced = state.status === 'idle' && online && pending.total === 0 && Boolean(state.lastSyncAt)
  const label = `${syncLabel(state, pending.total, pending.conflicts, online)} · Ctrl+S`

  return (
    <SyncContext.Provider value={syncValue}>
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        {pending.conflicts > 0 && (
          <div className="flex items-center gap-2 bg-amber-900/60 px-4 py-2 text-sm text-amber-100">
            <AlertTriangle size={16} />
            {pending.conflicts} conflito(s) de sync. Revise os itens marcados em amarelo (<code>.conflict-*</code>).
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 py-3">
            {SECTIONS.map(({ id, label: sectionLabel, icon: Icon }) => (
              <button
                key={id}
                onClick={() => void setSetting('section', id)}
                title={sectionLabel}
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
                disabled={syncBlocked || !online}
                title={label}
                aria-label={label}
                className={`${railButton} text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-60`}
              >
                {state.status === 'error' || !online ? (
                  <CloudOff size={18} className={state.status === 'error' ? 'text-red-400' : undefined} />
                ) : (
                  <RefreshCw size={18} className={state.status === 'syncing' ? 'animate-spin' : ''} />
                )}
                {state.status !== 'syncing' && online && state.status !== 'error' && pending.conflicts > 0 && (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-amber-400" />
                )}
                {state.status !== 'syncing' && online && state.status !== 'error' && pending.conflicts === 0 && pending.total > 0 && (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-sky-400" />
                )}
                {fullySynced && <span className="absolute top-2 right-2 size-2 rounded-full bg-emerald-400" />}
              </button>
              <button
                onClick={() => setConfirmDisconnect(true)}
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

      {confirmDisconnect && (
        <ConfirmDialog
          title="Desconectar"
          danger
          confirmLabel="Desconectar"
          message={
            <p className="text-zinc-300">
              Remover o token deste dispositivo e voltar à tela de conexão? As notas locais continuam salvas aqui; você
              precisará colar o token de novo para sincronizar.
            </p>
          }
          onConfirm={() => {
            setConfirmDisconnect(false)
            void clearRepoConfig()
          }}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}
    </SyncContext.Provider>
  )
}
