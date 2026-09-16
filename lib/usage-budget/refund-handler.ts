import type { RefundResult } from './types'

const REFUND_ATTEMPTS_PER_INVOCATION = 2

export function createUsageRefundHandler(params: {
  charged: boolean
  refund: () => Promise<RefundResult>
  onRefunded: (refund: RefundResult) => void
  onError?: (error: unknown) => void
}): () => Promise<void> {
  let completed = false
  let inFlight: Promise<void> | undefined

  return async () => {
    if (!params.charged || completed) return
    if (inFlight) return inFlight

    inFlight = (async () => {
      try {
        for (
          let attempt = 0;
          attempt < REFUND_ATTEMPTS_PER_INVOCATION && !completed;
          attempt += 1
        ) {
          try {
            const refund = await params.refund()
            completed = refund.refunded || refund.duplicate
            if (refund.refunded) params.onRefunded(refund)
          } catch (error) {
            params.onError?.(error)
          }
        }
      } finally {
        inFlight = undefined
      }
    })()

    return inFlight
  }
}
