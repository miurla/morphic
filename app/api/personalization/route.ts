import { NextResponse } from 'next/server'

import {
  PERSONALIZATION_COOKIE_NAME,
  sanitizePersonalizationSettings,
  serializePersonalizationCookie
} from '@/lib/agents/personalization'

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid personalization payload' },
      { status: 400 }
    )
  }

  const settings = sanitizePersonalizationSettings(body)
  const response = NextResponse.json({ ok: true, personalization: settings })

  response.cookies.set({
    name: PERSONALIZATION_COOKIE_NAME,
    value: serializePersonalizationCookie(settings),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  })

  return response
}
