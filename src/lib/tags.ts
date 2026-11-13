/** Trims, drops empties and removes case-insensitive duplicates, keeping the first spelling. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase()
      if (!tag || seen.has(key)) return false
      seen.add(key)
      return true
    })
}
