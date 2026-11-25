import { describe, expect, it } from 'vitest'

import { mean, percentile, retrievalMetrics } from './metrics'

describe('Tutor retrieval evaluation metrics', () => {
  it('measures recall and rank independently without double-counting sources', () => {
    expect(retrievalMetrics(['x', 'a', 'a', 'b'], ['a', 'b', 'c'], 3)).toEqual({
      recall: 2 / 3,
      precision: 2 / 3,
      reciprocalRank: 1 / 2,
      hit: 1
    })
  })

  it('does not count no-answer questions as perfect retrieval', () => {
    expect(retrievalMetrics([], [])).toEqual({
      recall: null,
      precision: null,
      reciprocalRank: null,
      hit: null
    })
    expect(mean([null, 0, 1])).toBe(0.5)
  })

  it('reports nearest-rank percentiles without inventing samples', () => {
    expect(percentile([], 0.95)).toBeNull()
    expect(percentile([100, 200, 300, 400, 500], 0.95)).toBe(500)
  })
})
