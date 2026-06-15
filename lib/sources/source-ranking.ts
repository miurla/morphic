import type { NormalizedSource } from './source-types'

function sourceDedupeKey(source: NormalizedSource): string {
  return source.canonicalUrl ?? source.url ?? source.id
}

export function dedupeNormalizedSources(
  sources: NormalizedSource[]
): NormalizedSource[] {
  const seen = new Set<string>()
  const deduped: NormalizedSource[] = []

  for (const source of sources) {
    const key = sourceDedupeKey(source)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(source)
  }

  return deduped
}
