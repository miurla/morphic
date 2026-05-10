import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { heartbeatRuns, heartbeats, userProfiles } from '@/lib/db/schema'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hbs = await db
      .select()
      .from(heartbeats)
      .where(eq(heartbeats.userId, userId))
      .orderBy(heartbeats.createdAt)

    const result = []
    for (const hb of hbs) {
      const runs = await db
        .select()
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.heartbeatId, hb.id))
        .orderBy(heartbeatRuns.runAt)
        .limit(10)

      result.push({ ...hb, runs })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[heartbeat] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch heartbeats' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { chatId, chatTitle, query, frequency, channel } = body

      // Get WhatsApp number from user profile
      const profiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1)
      const whatsappNumber = profiles[0]?.whatsappNumber ?? null

      const [hb] = await db
        .insert(heartbeats)
        .values({
          userId,
          chatId,
          chatTitle: chatTitle ?? 'Sans titre',
          query: query ?? chatTitle ?? '',
          frequency: frequency ?? 'daily',
          channel: channel ?? 'whatsapp',
          whatsappNumber
        })
        .returning()

      return NextResponse.json(hb)
    }

    if (action === 'toggle') {
      const { id } = body
      const [hb] = await db
        .select()
        .from(heartbeats)
        .where(and(eq(heartbeats.id, id), eq(heartbeats.userId, userId)))
        .limit(1)

      if (!hb) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const newStatus = hb.status === 'active' ? 'paused' : 'active'
      await db
        .update(heartbeats)
        .set({ status: newStatus })
        .where(eq(heartbeats.id, id))

      return NextResponse.json({ ...hb, status: newStatus })
    }

    if (action === 'delete') {
      const { id } = body
      await db
        .delete(heartbeats)
        .where(and(eq(heartbeats.id, id), eq(heartbeats.userId, userId)))
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[heartbeat] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    )
  }
}
