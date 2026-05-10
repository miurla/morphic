import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { heartbeats } from '@/lib/db/schema'

export const maxDuration = 300

export async function GET(req: Request) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active heartbeats
    const activeHeartbeats = await db
      .select()
      .from(heartbeats)
      .where(eq(heartbeats.status, 'active'))

    console.log(
      `[cron/heartbeat] Found ${activeHeartbeats.length} active heartbeats`
    )

    let executed = 0
    let failed = 0

    for (const hb of activeHeartbeats) {
      // Check if enough time has passed since last run
      const now = Date.now()
      const lastRun = hb.lastRunAt ? new Date(hb.lastRunAt).getTime() : 0
      const intervalMs =
        hb.frequency === 'daily'
          ? 24 * 60 * 60 * 1000
          : hb.frequency === 'weekly'
            ? 7 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000

      if (now - lastRun < intervalMs) {
        continue // Skip — not due yet
      }

      try {
        // Call the run API internally
        const baseUrl =
          process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'

        const res = await fetch(`${baseUrl}/api/heartbeat/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heartbeatId: hb.id })
        })

        if (res.ok) {
          executed++
        } else {
          failed++
          console.error(
            `[cron/heartbeat] Failed for ${hb.id}:`,
            await res.text()
          )
        }
      } catch (err) {
        failed++
        console.error(`[cron/heartbeat] Error for ${hb.id}:`, err)
      }
    }

    console.log(
      `[cron/heartbeat] Done: ${executed} executed, ${failed} failed`
    )

    return NextResponse.json({
      total: activeHeartbeats.length,
      executed,
      failed
    })
  } catch (error) {
    console.error('[cron/heartbeat] Error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
