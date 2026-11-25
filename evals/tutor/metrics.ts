export function retrievalMetrics(
  rankedIds: string[],
  relevantIds: string[],
  k = 6
) {
  const relevant = new Set(relevantIds)
  const ranked = [...new Set(rankedIds)].slice(0, k)
  const hits = ranked.filter(id => relevant.has(id)).length
  const first = ranked.findIndex(id => relevant.has(id))
  return {
    // No-answer cases need generation/refusal evaluation; they cannot be
    // assigned a meaningful retrieval recall simply because a list is empty.
    recall: relevant.size ? hits / relevant.size : null,
    precision: relevant.size ? hits / Math.max(1, ranked.length) : null,
    reciprocalRank: relevant.size ? (first < 0 ? 0 : 1 / (first + 1)) : null,
    hit: relevant.size ? Number(hits > 0) : null
  }
}

export function mean(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null)
  return known.length
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : null
}

export function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[
    Math.max(
      0,
      Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
    )
  ]
}
