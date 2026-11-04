// Vercel BotID only works on Vercel (checkBotId throws without an OIDC
// token), so it stays off unless the deployment opts in at build time.
export function isBotProtectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BOTID === 'true'
}

export const BOT_PROTECTED_ROUTES = [{ path: '/api/chat', method: 'POST' }]

export async function rejectIfBot(): Promise<Response | null> {
  if (!isBotProtectionEnabled()) return null

  try {
    const { checkBotId } = await import('botid/server')
    const verification = await checkBotId()
    if (!verification.isBot) return null
  } catch (error) {
    // A broken check should not take chat down for everyone.
    console.error('BotID check failed, allowing request:', error)
    return null
  }

  return Response.json(
    {
      error:
        'This request could not be verified. Reload the page and try again.',
      type: 'forbidden',
      code: 'forbidden',
      retryable: false
    },
    { status: 403 }
  )
}
