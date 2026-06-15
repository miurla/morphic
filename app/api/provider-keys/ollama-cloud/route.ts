import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  getOllamaCloudApiKeyFromCookieStore,
  OLLAMA_CLOUD_API_KEY_COOKIE,
  sanitizeOllamaCloudApiKey
} from '@/lib/ollama/cloud-api-key'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function GET() {
  const cookieStore = await cookies()
  const hasUserKey = Boolean(getOllamaCloudApiKeyFromCookieStore(cookieStore))
  const hasEnvironmentKey = Boolean(
    sanitizeOllamaCloudApiKey(process.env.OLLAMA_API_KEY)
  )

  return NextResponse.json({
    ok: true,
    configured: hasUserKey || hasEnvironmentKey,
    source: hasUserKey ? 'user' : hasEnvironmentKey ? 'environment' : 'none'
  })
}

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid Ollama Cloud key payload' },
      { status: 400 }
    )
  }

  const apiKey = sanitizeOllamaCloudApiKey(
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).apiKey
      : undefined
  )
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Ollama Cloud API key' },
      { status: 400 }
    )
  }

  const response = NextResponse.json({
    ok: true,
    configured: true,
    source: 'user'
  })

  response.cookies.set({
    name: OLLAMA_CLOUD_API_KEY_COOKIE,
    value: apiKey,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  })

  return response
}

export async function DELETE() {
  const hasEnvironmentKey = Boolean(
    sanitizeOllamaCloudApiKey(process.env.OLLAMA_API_KEY)
  )
  const response = NextResponse.json({
    ok: true,
    configured: hasEnvironmentKey,
    source: hasEnvironmentKey ? 'environment' : 'none'
  })

  response.cookies.set({
    name: OLLAMA_CLOUD_API_KEY_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  })

  return response
}
