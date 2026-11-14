import { openUrl } from '@tauri-apps/plugin-opener'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Adds `https://` to scheme-less links like `example.com/page`. */
export function absoluteUrl(url: string): string {
  return /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`
}

// Inside the desktop app's webview, window.open doesn't reach the system browser; the opener plugin does.
export function openExternal(url: string): void {
  const href = absoluteUrl(url.trim())
  if (isTauri) void openUrl(href)
  else window.open(href, '_blank', 'noopener,noreferrer')
}
