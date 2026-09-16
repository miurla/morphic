import { describe, expect, it, vi } from 'vitest'

import { createUsageRefundHandler } from '../refund-handler'
import type { RefundResult } from '../types'

function result(overrides: Partial<RefundResult>): RefundResult {
  return {
    refunded: false,
    duplicate: false,
    monthUsed: 0,
    hourUsed: 0,
    remaining: 100,
    limit: 100,
    resetAt: 0,
    amount: 0,
    enforced: false,
    ...overrides
  }
}

describe('usage refund handler', () => {
  it('allows a later invocation to retry a transient refund failure', async () => {
    const refund = vi
      .fn<() => Promise<RefundResult>>()
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(
        result({ refunded: true, amount: 2, remaining: 98, enforced: true })
      )
    const onRefunded = vi.fn()
    const handler = createUsageRefundHandler({
      charged: true,
      refund,
      onRefunded
    })

    await handler()
    await handler()
    await handler()

    expect(refund).toHaveBeenCalledTimes(2)
    expect(onRefunded).toHaveBeenCalledOnce()
  })

  it('treats a duplicate refund as completed', async () => {
    const refund = vi
      .fn<() => Promise<RefundResult>>()
      .mockResolvedValue(result({ duplicate: true, enforced: true }))
    const handler = createUsageRefundHandler({
      charged: true,
      refund,
      onRefunded: vi.fn()
    })

    await handler()
    await handler()

    expect(refund).toHaveBeenCalledOnce()
  })

  it('shares an in-flight refund between concurrent callers', async () => {
    let resolveRefund: ((value: RefundResult) => void) | undefined
    const refund = vi.fn(
      () =>
        new Promise<RefundResult>(resolve => {
          resolveRefund = resolve
        })
    )
    const handler = createUsageRefundHandler({
      charged: true,
      refund,
      onRefunded: vi.fn()
    })

    const first = handler()
    const second = handler()
    resolveRefund?.(result({ refunded: true, enforced: true }))
    await Promise.all([first, second])

    expect(refund).toHaveBeenCalledOnce()
  })
})
