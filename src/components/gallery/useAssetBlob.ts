import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import { useSyncContext } from '../../sync/SyncContext'

/** Image bytes from the local cache, downloaded from GitHub the first time `enabled` is true. */
export function useAssetBlob(path: string, enabled: boolean): { blob: Blob | null; failed: boolean } {
  const { service } = useSyncContext()
  const stored = useLiveQuery(async () => (path ? ((await db.blobs.get(path)) ?? null) : null), [path], 'loading' as const)
  const [failedPath, setFailedPath] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !path || stored !== null || failedPath === path) return
    let cancelled = false
    service.loadAsset(path).then(
      (blob) => {
        if (!blob && !cancelled) setFailedPath(path)
      },
      () => {
        if (!cancelled) setFailedPath(path)
      },
    )
    return () => {
      cancelled = true
    }
  }, [enabled, path, stored, failedPath, service])

  return {
    blob: stored && stored !== 'loading' ? stored.blob : null,
    failed: !path || failedPath === path,
  }
}
