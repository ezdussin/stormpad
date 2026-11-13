const FENCE_RE = /^\s*(```|~~~)/

// The rich editor's serializer emits extra blank lines around some blocks (e.g. tables).
export function collapseBlankLines(markdown: string): string {
  let inFence = false
  return markdown
    .split('\n')
    .filter((line, i, lines) => {
      if (FENCE_RE.test(line)) inFence = !inFence
      return inFence || line.trim() !== '' || (lines[i - 1] ?? '').trim() !== ''
    })
    .join('\n')
}
