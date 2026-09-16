import type { RefundResult } from './types'

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
        const refund = await params.refund()
        if (refund.refunded) params.onRefunded(refund)
        completed = refund.refunded || refund.duplicate
      } catch (error) {
        params.onError?.(error)
      } finally {
        inFlight = undefined
      }
    })()

    return inFlight
  }
}
