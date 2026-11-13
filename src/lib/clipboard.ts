// navigator.clipboard only exists in secure contexts (https or localhost), e.g. not when testing over a LAN IP.
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.append(el)
  el.select()
  document.execCommand('copy')
  el.remove()
}

export function canReadClipboard(): boolean {
  return typeof navigator.clipboard?.readText === 'function'
}

export async function readText(): Promise<string> {
  return canReadClipboard() ? navigator.clipboard.readText() : ''
}
