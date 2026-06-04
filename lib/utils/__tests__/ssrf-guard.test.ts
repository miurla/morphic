import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  isBlockedHostname,
  isPrivateIP,
  resolveAndValidateHost,
  safeFetch,
  SSRFError,
  validateOutboundUrl,
  validateUrl
} from '../../utils/ssrf-guard'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('validateUrl', () => {
  test('accepts http and https URLs', () => {
    expect(validateUrl('https://example.com').href).toBe(
      'https://example.com/'
    )
    expect(validateUrl('http://example.com/path?q=1').href).toBe(
      'http://example.com/path?q=1'
    )
  })

  test('blocks non-HTTP schemes', () => {
    expect(() => validateUrl('file:///etc/passwd')).toThrow(SSRFError)
    expect(() => validateUrl('ftp://example.com')).toThrow(SSRFError)
    expect(() => validateUrl('javascript:alert(1)')).toThrow(SSRFError)
    expect(() => validateUrl('data:text/html,<h1>hi</h1>')).toThrow(SSRFError)
    expect(() => validateUrl('gopher://evil.com')).toThrow(SSRFError)
  })

  test('blocks URLs with embedded credentials', () => {
    expect(() =>
      validateUrl('http://admin:secret@example.com')
    ).toThrow(SSRFError)
    expect(() => validateUrl('https://user@example.com')).toThrow(SSRFError)
  })

  test('throws on invalid URLs', () => {
    expect(() => validateUrl('not-a-url')).toThrow(SSRFError)
    expect(() => validateUrl('')).toThrow(SSRFError)
  })
})

describe('isPrivateIP', () => {
  test('blocks loopback addresses', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('127.255.255.255')).toBe(true)
    expect(isPrivateIP('::1')).toBe(true)
  })

  test('blocks RFC 1918 private ranges', () => {
    // 10.0.0.0/8
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('10.255.255.255')).toBe(true)
    // 172.16.0.0/12
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('172.31.255.255')).toBe(true)
    // 192.168.0.0/16
    expect(isPrivateIP('192.168.0.1')).toBe(true)
    expect(isPrivateIP('192.168.255.255')).toBe(true)
  })

  test('blocks link-local / metadata IP range', () => {
    expect(isPrivateIP('169.254.0.1')).toBe(true)
    expect(isPrivateIP('169.254.169.254')).toBe(true) // AWS/GCP metadata
  })

  test('blocks CGN / shared address space', () => {
    expect(isPrivateIP('100.64.0.1')).toBe(true)
    expect(isPrivateIP('100.127.255.255')).toBe(true)
  })

  test('blocks 0.0.0.0/8', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true)
    expect(isPrivateIP('0.255.255.255')).toBe(true)
  })

  test('blocks benchmark testing range', () => {
    expect(isPrivateIP('198.18.0.1')).toBe(true)
    expect(isPrivateIP('198.19.255.255')).toBe(true)
  })

  test('blocks multicast', () => {
    expect(isPrivateIP('224.0.0.1')).toBe(true)
    expect(isPrivateIP('239.255.255.255')).toBe(true)
  })

  test('blocks IPv6 link-local and ULA', () => {
    expect(isPrivateIP('fe80::1')).toBe(true)
    expect(isPrivateIP('fc00::1')).toBe(true)
    expect(isPrivateIP('fd12:3456::1')).toBe(true)
  })

  test('blocks IPv4-mapped IPv6 private addresses', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true)
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true)
  })

  test('allows public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
    expect(isPrivateIP('93.184.216.34')).toBe(false) // example.com
    expect(isPrivateIP('172.32.0.1')).toBe(false) // Just outside 172.16/12
    expect(isPrivateIP('100.128.0.1')).toBe(false) // Just outside CGN
  })
})

describe('isBlockedHostname', () => {
  test('blocks localhost', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('LOCALHOST')).toBe(true)
  })

  test('blocks .local domains', () => {
    expect(isBlockedHostname('myservice.local')).toBe(true)
    expect(isBlockedHostname('printer.local')).toBe(true)
  })

  test('blocks .internal domains', () => {
    expect(isBlockedHostname('app.internal')).toBe(true)
    expect(isBlockedHostname('metadata.google.internal')).toBe(true)
  })

  test('blocks kubernetes service DNS', () => {
    expect(isBlockedHostname('my-svc.default.svc.cluster.local')).toBe(true)
  })

  test('blocks .intranet, .corp, .lan', () => {
    expect(isBlockedHostname('portal.intranet')).toBe(true)
    expect(isBlockedHostname('wiki.corp')).toBe(true)
    expect(isBlockedHostname('nas.lan')).toBe(true)
  })

  test('blocks instance-data hostname', () => {
    expect(isBlockedHostname('instance-data')).toBe(true)
  })

  test('allows public hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false)
    expect(isBlockedHostname('google.com')).toBe(false)
    expect(isBlockedHostname('api.github.com')).toBe(false)
    expect(isBlockedHostname('localhost.com')).toBe(false) // Not exactly localhost
  })
})

describe('resolveAndValidateHost', () => {
  test('checks all resolved address families and blocks any private result', async () => {
    const dns = await import('node:dns')
    vi.spyOn(dns.default.promises, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: 'fd12:3456::1', family: 6 }
    ] as any)

    await expect(
      resolveAndValidateHost('example.com', 'https://example.com')
    ).rejects.toThrow(SSRFError)
  })
})

describe('validateOutboundUrl', () => {
  test('blocks private IP literals before fetch or extraction handoff', async () => {
    await expect(validateOutboundUrl('http://127.0.0.1/admin')).rejects.toThrow(
      SSRFError
    )
    await expect(
      validateOutboundUrl('http://169.254.169.254/latest/meta-data')
    ).rejects.toThrow(SSRFError)
  })

  test('blocks internal hostnames before fetch or extraction handoff', async () => {
    await expect(
      validateOutboundUrl('http://metadata.google.internal/computeMetadata/v1')
    ).rejects.toThrow(SSRFError)
  })
})

describe('safeFetch', () => {
  test('does not use platform automatic redirect following', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('ok', {
        status: 200
      })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await safeFetch('https://93.184.216.34/')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://93.184.216.34/',
      expect.objectContaining({ redirect: 'manual' })
    )
  })

  test('re-validates redirects and blocks redirects to private IPs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: 'http://127.0.0.1/admin'
        }
      })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(safeFetch('https://93.184.216.34/')).rejects.toThrow(
      SSRFError
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
