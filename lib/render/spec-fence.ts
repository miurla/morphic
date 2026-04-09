import type { Spec } from '@json-render/core'

import { createPartialSpecParser } from './parse-spec-block'

export type SpecFenceResult =
  | {
      status: 'pending'
      source: string
    }
  | {
      status: 'ready'
      source: string
      spec: Spec
    }

export type SpecFenceEvaluator = {
  evaluate(source: string): SpecFenceResult
  reset(): void
}

export function createSpecFenceEvaluator(): SpecFenceEvaluator {
  const partialParser = createPartialSpecParser()

  return {
    evaluate(source: string): SpecFenceResult {
      try {
        // Always use partial parser for incremental rendering.
        // streamdown's isIncomplete flag requires isAnimating which
        // we don't use, so we cannot rely on it.
        const spec = partialParser.parse(source)

        if (!spec) {
          return {
            status: 'pending',
            source
          }
        }

        return {
          status: 'ready',
          source,
          spec
        }
      } catch {
        return {
          status: 'pending',
          source
        }
      }
    },
    reset() {
      partialParser.reset()
    }
  }
}
