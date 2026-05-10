import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { unipileAccounts } from '@/lib/db/schema'

const UNIPILE_URL = process.env.UNIPILE_URL!
const UNIPILE_TOKEN = process.env.UNIPILE_TOKEN!

const uniHeaders = {
  'X-API-KEY': UNIPILE_TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json'
}

async function checkAccountRunning(accountId: string): Promise<boolean> {
  try {
    const res = await fetch(`${UNIPILE_URL}/accounts/${accountId}`, {
      headers: { 'X-API-KEY': UNIPILE_TOKEN, accept: 'application/json' }
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.sources?.some((s: any) => s.status === 'OK') ?? false
  } catch {
    return false
  }
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

      // Step 1: Check our DB by email
      const normalizedEmail = username.toLowerCase().trim()
      const existing = await db
        .select()
        .from(unipileAccounts)
        .where(eq(unipileAccounts.email, normalizedEmail))
        .limit(1)

      if (existing.length > 0) {
        const acc = existing[0]
        console.log(
          `[linkedin] Found in DB: ${acc.accountId} (${acc.email}) status=${acc.status}`
        )

        // Step 2: Verify it's still running on Unipile
        const isRunning = await checkAccountRunning(acc.accountId)

        if (isRunning) {
          console.log(`[linkedin] Account ${acc.accountId} is Running — skip`)
          return NextResponse.json({
            status: 'connected',
            accountId: acc.accountId
          })
        }

        // Step 3: Not running — reconnect
        console.log(`[linkedin] Account ${acc.accountId} not running, reconnecting...`)
        const res = await fetch(
          `${UNIPILE_URL}/accounts/${acc.accountId}`,
          {
            method: 'POST',
            headers: uniHeaders,
            body: JSON.stringify({ provider: 'LINKEDIN', username, password })
          }
        )
        const data = await res.json().catch(() => ({}))

        if (data.object === 'Checkpoint' || data.checkpoint) {
          return NextResponse.json({
            status: 'checkpoint',
            accountId: data.account_id || acc.accountId,
            checkpointType: data.checkpoint?.type || 'OTP'
          })
        }
        if (res.ok || data.object === 'AccountReconnected') {
          await db
            .update(unipileAccounts)
            .set({ status: 'RUNNING', syncedAt: new Date() })
            .where(eq(unipileAccounts.accountId, acc.accountId))
          return NextResponse.json({
            status: 'connected',
            accountId: data.account_id || acc.accountId
          })
        }

        // Reconnect failed but account exists — don't create a new one
        if (res.status !== 404) {
          return NextResponse.json(
            { error: data.detail || data.title || 'Reconnexion échouée' },
            { status: 400 }
          )
        }
      }

      // Step 4: Not in DB — create new account on Unipile
      console.log(`[linkedin] No account for "${normalizedEmail}" in DB, creating new...`)
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
          const newAccountId = data.account_id || data.id
          // Save to DB immediately
          await db.insert(unipileAccounts).values({
            accountId: newAccountId,
            email: normalizedEmail,
            provider: 'LINKEDIN',
            status: 'RUNNING',
            syncedAt: new Date()
          })
          return NextResponse.json({
            status: 'connected',
            accountId: newAccountId
          })
        }

        return NextResponse.json(
          { error: data.detail || data.title || 'Connexion échouée' },
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
        // Update status in DB
        await db
          .update(unipileAccounts)
          .set({ status: 'RUNNING', syncedAt: new Date() })
          .where(eq(unipileAccounts.accountId, accountId))
        return NextResponse.json({ status: 'connected', accountId })
      }

      return NextResponse.json(
        { error: data.detail || data.message || 'Code invalide' },
        { status: 400 }
      )
    }

    if (action === 'poll') {
      const { accountId } = body
      const isRunning = await checkAccountRunning(accountId)
      return NextResponse.json({
        status: isRunning ? 'connected' : 'pending'
      })
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
