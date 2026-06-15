import {
  listReadingItems,
  saveReadingItem,
  updateReadingItemStatus
} from '@/lib/actions/reading-items'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  normalizeReadingItemRequest,
  readingStatusSchema
} from '@/lib/sources/reading-items'

async function requireUserId() {
  const userId = await getCurrentUserId()
  return userId || null
}

export async function GET(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const rawStatus = url.searchParams.get('status') ?? undefined
  const parsedStatus = rawStatus
    ? readingStatusSchema.safeParse(rawStatus)
    : undefined

  if (parsedStatus && !parsedStatus.success) {
    return Response.json(
      { ok: false, error: 'Invalid status' },
      { status: 400 }
    )
  }

  const result = await listReadingItems(userId, {
    status: parsedStatus?.success ? parsedStatus.data : undefined
  })
  if (!result.success) {
    return Response.json(
      { ok: false, error: result.error },
      {
        status: 500
      }
    )
  }

  return Response.json({ ok: true, items: result.items })
}

export async function POST(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const readingItem = normalizeReadingItemRequest(body)
  if (!readingItem) {
    return Response.json(
      { ok: false, error: 'Invalid reading item' },
      { status: 400 }
    )
  }

  const result = await saveReadingItem(userId, readingItem)
  if (!result.success) {
    return Response.json(
      { ok: false, error: result.error },
      {
        status: 500
      }
    )
  }

  return Response.json(
    { ok: true, item: result.item, created: result.created },
    { status: result.created ? 201 : 200 }
  )
}

export async function PATCH(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return Response.json(
      { ok: false, error: 'Invalid request' },
      { status: 400 }
    )
  }

  const { id, status } = body as { id?: unknown; status?: unknown }
  const parsedStatus = readingStatusSchema.safeParse(status)
  if (typeof id !== 'string' || !id.trim() || !parsedStatus.success) {
    return Response.json(
      { ok: false, error: 'Invalid status' },
      { status: 400 }
    )
  }

  const result = await updateReadingItemStatus(
    userId,
    id.trim(),
    parsedStatus.data
  )
  if (!result.success) {
    return Response.json(
      { ok: false, error: result.error },
      {
        status: result.error === 'Reading item not found' ? 404 : 500
      }
    )
  }

  return Response.json({ ok: true, item: result.item })
}
