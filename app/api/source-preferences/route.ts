import {
  deleteSourcePreference,
  listSourcePreferences,
  upsertSourcePreference
} from '@/lib/actions/source-preferences'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { normalizeSourcePreferenceInput } from '@/lib/sources/source-preferences'

async function requireUserId() {
  const userId = await getCurrentUserId()
  return userId || null
}

export async function GET(req?: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const profileId = req ? new URL(req.url).searchParams.get('profileId') : null
  const result = profileId
    ? await listSourcePreferences(userId, { profileId })
    : await listSourcePreferences(userId)
  if (!result.success) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  return Response.json({ ok: true, preferences: result.preferences })
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

  const preference = normalizeSourcePreferenceInput(body)
  if (!preference) {
    return Response.json(
      { ok: false, error: 'Invalid source preference' },
      { status: 400 }
    )
  }

  const result = await upsertSourcePreference(userId, preference)
  if (!result.success) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  return Response.json({
    ok: true,
    preference: result.preference,
    created: result.created
  })
}

export async function DELETE(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')?.trim()
  if (!id) {
    return Response.json(
      { ok: false, error: 'Preference id is required' },
      { status: 400 }
    )
  }

  const result = await deleteSourcePreference(userId, id)
  if (!result.success) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.error === 'Source preference not found' ? 404 : 500 }
    )
  }

  return Response.json({ ok: true })
}
