import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refreshMemoriesWidget } from '../capacitor/widgetBridge'
import type { RepoConfig } from '../db/settings'
import { GitHubSyncService, type SyncResult } from './GitHubSyncService'

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000

export type SyncState =
  | { status: 'idle'; lastResult?: SyncResult; lastSyncAt?: number }
  | { status: 'syncing' }
  | { status: 'error'; message: string }

export function useSync(config: RepoConfig) {
  const { token, owner, repo, branch } = config
  const service = useMemo(
    () => new GitHubSyncService({ token, owner, repo, branch }),
    [token, owner, repo, branch],
  )
  const [state, setState] = useState<SyncState>({ status: 'idle' })
  const inFlight = useRef(false)

  const sync = useCallback(async () => {
    if (inFlight.current || !navigator.onLine) return
    inFlight.current = true
    setState({ status: 'syncing' })
    try {
      const lastResult = await service.sync()
      void refreshMemoriesWidget()
      setState({ status: 'idle', lastResult, lastSyncAt: Date.now() })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      inFlight.current = false
    }
  }, [service])

  useEffect(() => {
    void sync()
    const onOnline = () => void sync()
    window.addEventListener('online', onOnline)
    const interval = window.setInterval(() => void sync(), AUTO_SYNC_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [sync])

  return { state, sync, service }
}
