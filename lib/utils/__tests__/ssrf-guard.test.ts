import dns from 'node:dns'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveAndValidateHost, SSRFError } from '../ssrf-guard'

vi.mock('node:dns', async () => {
  const actual = await vi.importActual<typeof import('node:dns')>('node:dns')
  const mockedDns = {
    ...actual,
    promises: {
      lookup: vi.fn()
    }
  }

  return {
    ...mockedDns,
    default: mockedDns
  }
})

describe('ssrf guard DNS failure mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SSRF_DNS_FAILURE_MODE
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
  })

  it('fails closed on DNS resolution errors in cloud deployments', async () => {
    vi.mocked(dns.promises.lookup).mockRejectedValue(new Error('dns down'))

    await expect(
      resolveAndValidateHost('example.com', 'https://example.com')
    ).rejects.toBeInstanceOf(SSRFError)
  })

  it('can explicitly fail open for local development compatibility', async () => {
    process.env.SSRF_DNS_FAILURE_MODE = 'fail-open'
    vi.mocked(dns.promises.lookup).mockRejectedValue(new Error('dns down'))

    await expect(
      resolveAndValidateHost('example.com', 'https://example.com')
    ).resolves.toBeUndefined()
  })
})
