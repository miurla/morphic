import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'

const UNIPILE_URL = process.env.UNIPILE_URL!
const UNIPILE_TOKEN = process.env.UNIPILE_TOKEN!

const uniHeaders = {
  'X-API-KEY': UNIPILE_TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json'
}

type UnipileAccount = {
  id: string
  type: string
  name: string
  created_at: string
  sources?: { status: string }[]
  connection_params?: {
    im?: {
      id?: string
      username?: string
      publicIdentifier?: string
    }
  }
}

async function listLinkedInAccounts(): Promise<UnipileAccount[]> {
  const res = await fetch(`${UNIPILE_URL}/accounts`, {
    headers: { 'X-API-KEY': UNIPILE_TOKEN, accept: 'application/json' }
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []).filter((a: any) => a.type === 'LINKEDIN')
}

function isAccountRunning(acc: UnipileAccount): boolean {
  return acc.sources?.some(s => s.status === 'OK') ?? false
}

function checkAccountStatus(acc: UnipileAccount): string {
  const src = acc.sources?.[0]
  return src?.status ?? 'UNKNOWN'
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

      // Step 1: Check our DB for a stored Unipile account ID
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

      // Step 2: List all LinkedIn accounts on Unipile
      const linkedinAccounts = await listLinkedInAccounts()
      console.log(
        `[linkedin] ${linkedinAccounts.length} LinkedIn accounts on Unipile, storedId=${storedAccountId}`
      )

      // Step 3: Find the right account
      let targetAccount: UnipileAccount | undefined

      // 3a. If we have a stored ID, find it
      if (storedAccountId) {
        targetAccount = linkedinAccounts.find(a => a.id === storedAccountId)
      }

      // 3b. If not found in DB, try to match by LinkedIn IM id or name
      if (!targetAccount) {
        const normalizedInput = username.toLowerCase().trim()
        targetAccount = linkedinAccounts.find(a => {
          const candidates = [
            a.connection_params?.im?.username,
            a.connection_params?.im?.publicIdentifier,
            a.name
          ].filter(Boolean)
          return candidates.some(
            c => c!.toLowerCase().trim() === normalizedInput
          )
        })
      }

      // 3c. If still not found and there's only one LinkedIn account, use it
      if (!targetAccount && linkedinAccounts.length === 1) {
        targetAccount = linkedinAccounts[0]
        console.log(
          `[linkedin] Using single LinkedIn account: ${targetAccount.id}`
        )
      }

      // Step 4: If account found and running → just link it, no reconnection needed
      if (targetAccount && isAccountRunning(targetAccount)) {
        console.log(
          `[linkedin] Account ${targetAccount.id} is Running — linking directly`
        )
        return NextResponse.json({
          status: 'connected',
          accountId: targetAccount.id
        })
      }

      // Step 5: If account found but not running → reconnect
      if (targetAccount) {
        console.log(
          `[linkedin] Account ${targetAccount.id} status=${checkAccountStatus(targetAccount)}, reconnecting...`
        )
        const res = await fetch(
          `${UNIPILE_URL}/accounts/${targetAccount.id}`,
          {
            method: 'POST',
            headers: uniHeaders,
            body: JSON.stringify({ provider: 'LINKEDIN', username, password })
          }
        )
        const data = await res.json().catch(() => ({}))
        console.log(
          `[linkedin] Reconnect ${res.status}:`,
          JSON.stringify(data).slice(0, 300)
        )

        if (data.object === 'Checkpoint' || data.checkpoint) {
          return NextResponse.json({
            status: 'checkpoint',
            accountId: data.account_id || targetAccount.id,
            checkpointType: data.checkpoint?.type || 'OTP'
          })
        }
        if (res.ok || data.object === 'AccountReconnected') {
          return NextResponse.json({
            status: 'connected',
            accountId: data.account_id || targetAccount.id
          })
        }
        // If reconnect fails with 404, account is gone — fall through to create
        if (res.status !== 404) {
          return NextResponse.json(
            {
              error:
                data.detail || data.title || data.message || 'Reconnexion échouée'
            },
            { status: 400 }
          )
        }
      }

      // Step 6: No existing account → create new
      console.log(`[linkedin] No existing account found, creating new...`)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      try {
        const res = await fetch(`${UNIPILE_URL}/accounts`, {
          method: 'POST',
          headers: uniHeaders,
          body: JSON.stringify({ provider: 'LINKEDIN', username, password }),
          signal: controller.signal
        })

        const data = await res.json().catch(() => ({}))

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
          {
            error:
              data.detail || data.title || data.message || 'Connexion échouée'
          },
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
        headers: uniHeaders,
        body: JSON.stringify({
          provider: 'LINKEDIN',
          account_id: accountId,
          code
        })
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 202) {
        return NextResponse.json({
          status: 'checkpoint',
          accountId: data.account_id || accountId,
          checkpointType: data.checkpoint?.type || 'OTP'
        })
      }

      if (res.ok) {
        return NextResponse.json({ status: 'connected', accountId })
      }

      return NextResponse.json(
        { error: data.detail || data.message || 'Code invalide' },
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
        if (data.id) return NextResponse.json({ status: 'connected' })
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
