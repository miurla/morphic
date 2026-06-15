import { recordSourceEvent } from '@/lib/actions/source-events'
import { normalizeSourceEventRequest } from '@/lib/sources/source-events'
import { hasSupabasePublicConfig } from '@/lib/supabase/keys'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const event = normalizeSourceEventRequest(body)
  if (!event) {
    return Response.json(
      { ok: false, error: 'Invalid source event' },
      { status: 400 }
    )
  }

  let userId: string | null = null

  if (hasSupabasePublicConfig()) {
    try {
      const supabase = await createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch (error) {
      console.error('Failed to resolve source event user:', error)
    }
  }

  const result = await recordSourceEvent({
    ...event,
    userId
  })

  if (!result.success) {
    console.error('Source event persistence failed:', result.error)
  }

  return Response.json(
    { ok: true, stored: result.success },
    {
      status: 202
    }
  )
}
