import {
  deleteSourcePreferenceProfile,
  listSourcePreferenceProfiles,
  upsertSourcePreferenceProfile
} from '@/lib/actions/source-preferences'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { normalizeSourcePreferenceProfileInput } from '@/lib/sources/source-preference-profiles'

async function requireUserId() {
  const userId = await getCurrentUserId()
  return userId || null
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await listSourcePreferenceProfiles(userId)
  if (!result.success) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  return Response.json({ ok: true, profiles: result.profiles })
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

  const profile = normalizeSourcePreferenceProfileInput(body)
  if (!profile) {
    return Response.json(
      { ok: false, error: 'Invalid source preference profile' },
      { status: 400 }
    )
  }

  const result = await upsertSourcePreferenceProfile(userId, profile)
  if (!result.success) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  return Response.json({
    ok: true,
    profile: result.profile,
    created: result.created
  })
}

export async function DELETE(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) {
    return Response.json(
      { ok: false, error: 'Profile id is required' },
      { status: 400 }
    )
  }

  const result = await deleteSourcePreferenceProfile(userId, id)
  if (!result.success) {
    return Response.json(
      { ok: false, error: result.error },
      {
        status:
          result.error === 'Source preference profile not found' ? 404 : 500
      }
    )
  }

  return Response.json({ ok: true })
}
