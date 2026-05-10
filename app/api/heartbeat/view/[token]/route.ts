import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { heartbeatRuns, heartbeats } from '@/lib/db/schema'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const [run] = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.viewToken, token))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [hb] = await db
      .select()
      .from(heartbeats)
      .where(eq(heartbeats.id, run.heartbeatId))
      .limit(1)

    return NextResponse.json({ heartbeat: hb ?? null, run })
  } catch (error) {
    console.error('[heartbeat/view] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
