// @vitest-environment node
import type { LookupAddress } from 'node:dns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dnsLookup = vi.fn()

vi.mock('node:dns', () => ({
  lookup: (
    hostname: string,
    options: unknown,
    callback: (error: unknown, addresses: unknown) => void
  ) => dnsLookup(hostname, options, callback)
}))

const { guardedLookup } = await import('@/lib/utils/safe-fetch')

function resolveTo(addresses: LookupAddress[]) {
  dnsLookup.mockImplementation((_hostname, _options, callback) => {
    callback(null, addresses)
  })
}

function call(options: Record<string, unknown>) {
  return new Promise<{
    error: unknown
    address: string | LookupAddress[]
    family?: number
  }>(resolve => {
    guardedLookup('example.com', options, (error, address, family) =>
      resolve({ error, address, family })
    )
  })
}

describe('guardedLookup callback contract', () => {
  beforeEach(() => {
    dnsLookup.mockReset()
  })

  /**
   * Family autoselection is what `net.connect` turns on by default, and it
   * hands back the whole list. Answering it with a single string aborts the
   * connection, which would take down every allowed host rather than a
   * blocked one.
   */
  it('answers an all-address lookup with the list', async () => {
    const addresses = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
    ]
    resolveTo(addresses)

    const result = await call({ all: true })

    expect(result.error).toBeNull()
    expect(result.address).toEqual(addresses)
  })

  it('answers a single-address lookup with the address and family', async () => {
    resolveTo([{ address: '93.184.216.34', family: 4 }])

    const result = await call({})

    expect(result.error).toBeNull()
    expect(result.address).toBe('93.184.216.34')
    expect(result.family).toBe(4)
  })

  it('refuses the host when any answer is private', async () => {
    resolveTo([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ])

    const result = await call({ all: true })

    expect(result.error).toBeInstanceOf(Error)
  })

  it('refuses an empty answer', async () => {
    resolveTo([])

    const result = await call({ all: true })

    expect(result.error).toBeInstanceOf(Error)
  })
})
