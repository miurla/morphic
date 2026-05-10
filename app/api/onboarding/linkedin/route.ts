import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'

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
  if (!res.ok) {
    console.error('[linkedin] Failed to list accounts:', res.status)
    return null
  }
  const data = await res.json()
  const accounts: any[] = data.items ?? []
  const normalizedInput = username.toLowerCase().trim()

  // Unipile doesn't store the login email — match by name, publicIdentifier, or IM username
  const match = accounts.find((acc: any) => {
    if (acc.type !== 'LINKEDIN') return false
    const candidates = [
      acc.connection_params?.im?.username,
      acc.connection_params?.im?.publicIdentifier,
      acc.name
    ].filter(Boolean)

    return candidates.some(
      (c: string) => c.toLowerCase().trim() === normalizedInput
    )
  })

  if (match) {
    console.log(`[linkedin] Found existing account: ${match.id} (${match.name})`)
    return match.id
  }

  // If no exact match but there's a single LINKEDIN account, use it
  // (common case: user has only one LinkedIn connected)
  const linkedinAccounts = accounts.filter(
    (acc: any) => acc.type === 'LINKEDIN'
  )
  if (linkedinAccounts.length === 1) {
    console.log(
      `[linkedin] No name match but found single LinkedIn account: ${linkedinAccounts[0].id}`
    )
    return linkedinAccounts[0].id
  }

  console.log(
    `[linkedin] No match for "${username}" among ${accounts.length} accounts (${linkedinAccounts.length} LinkedIn)`
  )
  return null
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

      // 1. Check our DB first for stored account ID
      const userId = await getCurrentUserId()
      let storedAccountId: string | null = null
      if (userId) {
        const profiles = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId))
          .limit(1)
        storedAccountId = profiles[0]?.unipileAccountId ?? null
      }

      // 2. Then check Unipile for existing accounts
      const existingId = storedAccountId ?? (await findExistingAccount(username))

      if (existingId) {
        console.log(`[linkedin] Reconnecting existing account: ${existingId}`)
        const res = await fetch(`${UNIPILE_URL}/accounts/${existingId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'LINKEDIN',
            username,
            password
          })
        })
        const rawText = await res.text()
        let data: any
        try {
          data = JSON.parse(rawText)
        } catch {
          data = { raw: rawText }
        }

        console.log(`[linkedin] Reconnect response (${res.status}):`, JSON.stringify(data).slice(0, 500))

        if (data.object === 'Checkpoint' || data.checkpoint) {
          return NextResponse.json({
            status: 'checkpoint',
            accountId: data.account_id || existingId,
            checkpointType: data.checkpoint?.type || 'OTP'
          })
        }

        if (res.ok || data.object === 'AccountReconnected') {
          return NextResponse.json({
            status: 'connected',
            accountId: data.account_id || existingId
          })
        }

        // If reconnect fails (404 = account deleted), fall through to create
        if (res.status === 404) {
          console.log(`[linkedin] Account ${existingId} not found, creating new`)
        } else {
          return NextResponse.json(
            { error: data.detail || data.title || data.message || 'Reconnexion échouée' },
            { status: 400 }
          )
        }
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
