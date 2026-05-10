import { NextResponse } from 'next/server'

const UNIPILE_URL = process.env.UNIPILE_URL!
const UNIPILE_TOKEN = process.env.UNIPILE_TOKEN!

const headers = {
  'X-API-KEY': UNIPILE_TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json'
}

async function findExistingAccount(username: string): Promise<string | null> {
  const res = await fetch(`${UNIPILE_URL}/accounts`, {
    headers: { 'X-API-KEY': UNIPILE_TOKEN, accept: 'application/json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  const accounts: any[] = data.items ?? []

  const match = accounts.find((acc: any) => {
    const accUsername =
      acc.connection_params?.username ||
      acc.connection_params?.im?.username ||
      acc.name ||
      ''
    return (
      accUsername.toLowerCase() === username.toLowerCase() &&
      acc.provider === 'LINKEDIN'
    )
  })

  return match?.id ?? null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'connect') {
      const { username, password } = body
      if (!username || !password) {
        return NextResponse.json(
          { error: 'Email et mot de passe requis' },
          { status: 400 }
        )
      }

      const existingId = await findExistingAccount(username)

      if (existingId) {
        const res = await fetch(`${UNIPILE_URL}/accounts/${existingId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'LINKEDIN',
            username,
            password
          })
        })
        const data = await res.json()

        if (data.object === 'Checkpoint' || data.checkpoint) {
          return NextResponse.json({
            status: 'checkpoint',
            accountId: data.account_id || existingId,
            checkpointType: data.checkpoint?.type || 'OTP'
          })
        }

        if (res.ok) {
          return NextResponse.json({
            status: 'connected',
            accountId: existingId
          })
        }

        return NextResponse.json(
          { error: data.message || 'Reconnexion échouée' },
          { status: 400 }
        )
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      try {
        const res = await fetch(`${UNIPILE_URL}/accounts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'LINKEDIN',
            username,
            password
          }),
          signal: controller.signal
        })

        const rawText = await res.text()
        let data: any
        try {
          data = JSON.parse(rawText)
        } catch {
          data = { raw: rawText }
        }

        if (data.object === 'Checkpoint' || data.checkpoint) {
          return NextResponse.json({
            status: 'checkpoint',
            accountId: data.account_id,
            checkpointType: data.checkpoint?.type || 'OTP'
          })
        }

        if (res.ok) {
          return NextResponse.json({
            status: 'connected',
            accountId: data.account_id || data.id
          })
        }

        return NextResponse.json(
          { error: data.message || data.error || 'Connexion échouée' },
          { status: 400 }
        )
      } finally {
        clearTimeout(timeout)
      }
    }

    if (action === 'checkpoint') {
      const { accountId, code } = body
      if (!accountId || !code) {
        return NextResponse.json(
          { error: 'Account ID et code requis' },
          { status: 400 }
        )
      }

      const res = await fetch(`${UNIPILE_URL}/accounts/checkpoint`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: 'LINKEDIN',
          account_id: accountId,
          code
        })
      })

      const data = await res.json()

      if (res.status === 202) {
        return NextResponse.json({
          status: 'checkpoint',
          accountId: data.account_id || accountId,
          checkpointType: data.checkpoint?.type || 'OTP'
        })
      }

      if (res.ok) {
        return NextResponse.json({
          status: 'connected',
          accountId
        })
      }

      return NextResponse.json(
        { error: data.message || 'Code invalide' },
        { status: 400 }
      )
    }

    if (action === 'poll') {
      const { accountId } = body
      const res = await fetch(`${UNIPILE_URL}/accounts/${accountId}`, {
        headers: { 'X-API-KEY': UNIPILE_TOKEN, accept: 'application/json' }
      })

      if (res.status === 404) {
        return NextResponse.json({ status: 'pending' })
      }

      if (res.ok) {
        const data = await res.json()
        if (data.id) {
          return NextResponse.json({ status: 'connected' })
        }
      }

      return NextResponse.json({ status: 'pending' })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Timeout — LinkedIn met trop de temps. Réessaie.' },
        { status: 504 }
      )
    }
    console.error('[onboarding/linkedin] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
