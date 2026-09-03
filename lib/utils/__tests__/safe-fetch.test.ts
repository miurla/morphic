// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BLOCKED_URL_SENTINEL } from '@/lib/errors/tool-error'
import {
  assertPublicUrl,
  isBlockedAddress,
  safeFetch
} from '@/lib/utils/safe-fetch'

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.1.2.3',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'fec0::1',
    'ff02::1',
    // The metadata address wearing each of its IPv6 disguises.
    '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe',
    // ::ffff:0:0:0/96, the translatable prefix, one group over from the mapped
    // form above.
    '::ffff:0:a9fe:a9fe',
    '::ffff:0:127.0.0.1',
    '64:ff9b::169.254.169.254',
    // RFC 8215 local-use NAT64, which embeds IPv4 at a different offset.
    '64:ff9b:1::169.254.169.254',
    '64:ff9b:1:ffff::1',
    // Reserved ranges a host network can still route somewhere internal.
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '192.88.99.1',
    '2001:db8::1'
  ])('blocks %s', address => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each([
    '1.1.1.8',
    '8.8.8.8',
    '93.184.216.34',
    '172.32.0.1',
    '2606:4700::1111'
  ])('allows %s', address => {
    expect(isBlockedAddress(address)).toBe(false)
  })

  it('blocks anything that is not an address', () => {
    expect(isBlockedAddress('not-an-address')).toBe(true)
  })
})

describe('assertPublicUrl', () => {
  it('rejects a private literal', () => {
    expect(() =>
      assertPublicUrl('http://169.254.169.254/latest/meta-data/')
    ).toThrow(BLOCKED_URL_SENTINEL)
    expect(() => assertPublicUrl('http://[::1]:8080/')).toThrow(
      BLOCKED_URL_SENTINEL
    )
  })

  it('rejects a non-http scheme', () => {
    expect(() => assertPublicUrl('file:///etc/passwd')).toThrow(
      BLOCKED_URL_SENTINEL
    )
  })

  it('accepts a public URL', () => {
    expect(() => assertPublicUrl('https://example.com/page')).not.toThrow()
  })

  it('accepts a private literal once the network is opted in', () => {
    vi.stubEnv('FETCH_ALLOW_PRIVATE_NETWORK', 'true')
    expect(() => assertPublicUrl('http://127.0.0.1:3000/')).not.toThrow()
    vi.unstubAllEnvs()
  })
})

describe('safeFetch against a live loopback server', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  async function withServer<T>(
    run: (port: number, hits: () => number) => Promise<T>
  ) {
    let hits = 0
    const server = http.createServer((_, res) => {
      hits += 1
      res.end('secret')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo

    try {
      return await run(port, () => hits)
    } finally {
      await new Promise<void>(resolve => {
        server.close(() => resolve())
      })
    }
  }

  // `localhost` is a name, so nothing but the connect-time lookup can catch it.
  it('refuses a hostname that resolves to loopback, without connecting', async () => {
    await withServer(async (port, hits) => {
      await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow()
      expect(hits()).toBe(0)
    })
  })

  it('reaches the same server once the network is opted in', async () => {
    vi.stubEnv('FETCH_ALLOW_PRIVATE_NETWORK', 'true')

    await withServer(async (port, hits) => {
      const response = await safeFetch(`http://localhost:${port}/`)
      expect(await response.text()).toBe('secret')
      expect(hits()).toBe(1)
    })
  })
})

describe('safeFetch redirects', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('re-checks every hop', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' }
          })
      )
    )

    await expect(safeFetch('https://example.com/start')).rejects.toThrow(
      BLOCKED_URL_SENTINEL
    )
  })

  it('gives up on a chain that never lands', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/next' }
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('https://example.com/start')).rejects.toThrow(
      'Too many redirects'
    )
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})
