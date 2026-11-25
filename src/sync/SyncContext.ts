import { createContext, useContext } from 'react'
import type { GitHubSyncService } from './GitHubSyncService'
import type { SyncState } from './useSync'

export interface SyncContextValue {
  state: SyncState
  sync: () => Promise<void>
  /** True while a sync is running or the post-start cooldown is active. */
  syncBlocked: boolean
  service: GitHubSyncService
}

export const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncContext(): SyncContextValue {
  const value = useContext(SyncContext)
  if (!value) throw new Error('useSyncContext must be used inside SyncContext.Provider')
  return value
}
