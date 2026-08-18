import { RegressionError } from '@langfuse/client'
import { describe, expect, test } from 'vitest'

import { applyGate, type GateCheck } from '../gate'

const result = {} as Parameters<typeof applyGate>[0]

function check(overrides: Partial<GateCheck> = {}): GateCheck {
  return {
    metric: 'falsePositiveRate',
    value: 0.167,
    samples: 12,
    threshold: { direction: 'max', value: 0.15, minSamples: 30 },
    ...overrides
  }
}

describe('applyGate', () => {
  test('does not enforce a threshold below its minimum sample size', () => {
    expect(() => applyGate(result, [check()])).not.toThrow()
  })

  test('enforces the same threshold once the sample is large enough', () => {
    expect(() => applyGate(result, [check({ samples: 36 })])).toThrow(
      RegressionError
    )
  })

  test('enforces a threshold that declares no minimum', () => {
    expect(() =>
      applyGate(result, [
        check({
          metric: 'completionRate',
          value: 0.8,
          samples: 5,
          threshold: { direction: 'min', value: 0.9 }
        })
      ])
    ).toThrow(RegressionError)
  })

  test('ignores a metric with no threshold', () => {
    expect(() =>
      applyGate(result, [
        check({ threshold: { direction: 'max', value: null, minSamples: 30 } })
      ])
    ).not.toThrow()
  })
})
