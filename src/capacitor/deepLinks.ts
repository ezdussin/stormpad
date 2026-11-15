import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { setSetting } from '../db/settings'

/** Handle stormpad://memories (and ?id=) from the home-screen widget. */
export function parseStormpadDeepLink(url: string): { section: 'memories'; memoryId?: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'stormpad:') return null
    const host = parsed.hostname || parsed.pathname.replace(/^\//, '').split('/')[0]
    if (host !== 'memories') return null
    const memoryId = parsed.searchParams.get('id') ?? undefined
    return { section: 'memories', memoryId }
  } catch {
    return null
  }
}

async function openFromUrl(url: string): Promise<void> {
  const target = parseStormpadDeepLink(url)
  if (!target) return
  await setSetting('section', target.section)
  if (target.memoryId) await setSetting('deep_link_memory_id', target.memoryId)
}

/** Subscribe to Capacitor app URL opens. No-op outside native shells. */
export function startDeepLinkListener(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const handle = (event: URLOpenListenerEvent) => {
    void openFromUrl(event.url)
  }

  const listener = App.addListener('appUrlOpen', handle)

  void App.getLaunchUrl().then((result) => {
    if (result?.url) void openFromUrl(result.url)
  })

  return () => {
    void listener.then((registration) => registration.remove())
  }
}
