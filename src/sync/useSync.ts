import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refreshMemoriesWidget } from '../capacitor/widgetBridge'
import type { RepoConfig } from '../db/settings'
import { GitHubSyncService, type SyncResult } from './GitHubSyncService'

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000
/** Blocks a new manual/auto sync for a short window after one starts, so spam-clicks don't queue. */
const SYNC_COOLDOWN_MS = 4_000

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
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const inFlight = useRef(false)
  const cooldownUntilRef = useRef(0)

  const sync = useCallback(async () => {
    if (inFlight.current || !navigator.onLine) return
    const now = Date.now()
    if (now < cooldownUntilRef.current) return

    inFlight.current = true
    cooldownUntilRef.current = now + SYNC_COOLDOWN_MS
    setCooldownUntil(cooldownUntilRef.current)
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
    const remaining = cooldownUntil - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setCooldownUntil(0), remaining)
    return () => window.clearTimeout(timer)
  }, [cooldownUntil])

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

  const syncBlocked = state.status === 'syncing' || cooldownUntil > Date.now()

  return { state, sync, syncBlocked, service }
}
