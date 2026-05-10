import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { unipileAccounts } from '@/lib/db/schema'

const UNIPILE_URL = process.env.UNIPILE_URL!
const UNIPILE_TOKEN = process.env.UNIPILE_TOKEN!
const uniHeaders = {
  'X-API-KEY': UNIPILE_TOKEN,
  accept: 'application/json'
}

export async function POST() {
  try {
    // Step 1: List all accounts from Unipile
    const listRes = await fetch(`${UNIPILE_URL}/accounts`, {
      headers: uniHeaders
    })
    if (!listRes.ok) {
      return NextResponse.json(
        { error: 'Failed to list Unipile accounts' },
        { status: 502 }
      )
    }
    const listData = await listRes.json()
    const accounts: any[] = (listData.items ?? []).filter(
      (a: any) => a.type === 'LINKEDIN'
    )

    console.log(`[sync] Found ${accounts.length} LinkedIn accounts on Unipile`)

    let synced = 0
    let skipped = 0

    // Step 2: For each account, fetch email via /users/me then upsert in DB
    for (const acc of accounts) {
      const accountId = acc.id as string
      const status =
        acc.sources?.some((s: any) => s.status === 'OK') ? 'RUNNING' : 'DISCONNECTED'
      const linkedinUrnId = acc.connection_params?.im?.id ?? null
      const publicIdentifier =
        acc.connection_params?.im?.publicIdentifier ?? null
      const name = acc.name ?? null

      // Fetch email from /users/me
      let email: string | null = null
      try {
        const meRes = await fetch(
          `${UNIPILE_URL}/users/me?account_id=${accountId}`,
          { headers: uniHeaders }
        )
        if (meRes.ok) {
          const me = await meRes.json()
          email = me.email ?? null
        }
      } catch {
        console.warn(`[sync] Failed to fetch /users/me for ${accountId}`)
      }

      // Upsert in DB
      const existing = await db
        .select()
        .from(unipileAccounts)
        .where(eq(unipileAccounts.accountId, accountId))
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(unipileAccounts)
          .set({
            email,
            name,
            publicIdentifier,
            linkedinUrnId,
            status,
            syncedAt: new Date()
          })
          .where(eq(unipileAccounts.accountId, accountId))
        skipped++
      } else {
        await db.insert(unipileAccounts).values({
          accountId,
          email,
          provider: 'LINKEDIN',
          name,
          publicIdentifier,
          linkedinUrnId,
          status,
          syncedAt: new Date()
        })
        synced++
      }

      console.log(
        `[sync] ${existing.length > 0 ? 'Updated' : 'Created'}: ${accountId} (${email ?? 'no email'}) [${status}]`
      )
    }

    return NextResponse.json({
      total: accounts.length,
      synced,
      updated: skipped
    })
  } catch (error) {
    console.error('[sync] Error:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}
