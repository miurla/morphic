import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const checkBotId = vi.fn()
vi.mock('botid/server', () => ({ checkBotId }))

import { rejectIfBot } from '@/lib/bot-protection'

describe('rejectIfBot', () => {
  beforeEach(() => {
    checkBotId.mockReset()
    vi.stubEnv('BOTID_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('skips the check when BotID is not enabled', async () => {
    vi.stubEnv('BOTID_ENABLED', 'false')

    expect(await rejectIfBot()).toBeNull()
    expect(checkBotId).not.toHaveBeenCalled()
  })

  it('allows humans', async () => {
    checkBotId.mockResolvedValue({ isBot: false })

    expect(await rejectIfBot()).toBeNull()
  })

  it('rejects bots with a forbidden payload', async () => {
    checkBotId.mockResolvedValue({ isBot: true })

    const response = await rejectIfBot()

    expect(response?.status).toBe(403)
    expect(await response?.json()).toMatchObject({
      type: 'forbidden',
      code: 'forbidden',
      retryable: false
    })
  })

  it('allows the request when the check itself fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    checkBotId.mockRejectedValue(new Error('VERCEL_OIDC_TOKEN is not set'))

    expect(await rejectIfBot()).toBeNull()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
