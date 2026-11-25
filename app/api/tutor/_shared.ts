import { NextRequest, NextResponse } from 'next/server'

import { ZodError } from 'zod'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { AI_SERVICE_CONFIGURATION_ERROR } from '@/lib/errors/public-error'
import { type Locale, resolveRequestLocale } from '@/lib/i18n/config'
import { translate } from '@/lib/i18n/translate'
import { TutorError } from '@/lib/tutor/errors'
import { TutorRepositoryError } from '@/lib/tutor/repository'

/** Next may normalize loopback URLs to localhost. The HTTP Host is the browser's
 * actual destination, and must take precedence over that normalized URL. Never
 * accept an arbitrary X-Forwarded-Host as an additional trusted origin. */
export function isTutorSameOrigin(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  if (!origin && !referer) return true // Non-browser API clients.
  try {
    const source = new URL(origin || referer!)
    if (!['http:', 'https:'].includes(source.protocol)) return false
    if (origin && source.origin !== origin) return false
    const configuredOrigin = process.env.TUTOR_PUBLIC_ORIGIN?.trim()
    let expected: URL
    if (configuredOrigin) {
      expected = new URL(configuredOrigin)
      if (expected.origin !== configuredOrigin) return false
    } else {
      const raw = new URL(request.url)
      const host = request.headers.get('host') || raw.host
      expected = new URL(`${raw.protocol}//${host}`)
      if (
        expected.username ||
        expected.password ||
        expected.pathname !== '/' ||
        expected.search ||
        expected.hash
      )
        return false
    }
    return source.origin === expected.origin
  } catch {
    return false
  }
}

export async function tutorRoute(
  request: NextRequest,
  handler: (userId: string, locale: Locale) => Promise<Response>
) {
  const locale = resolveRequestLocale(request.headers)
  try {
    if (request.method !== 'GET') {
      if (!isTutorSameOrigin(request))
        return NextResponse.json(
          {
            error:
              locale === 'zh-CN' ? '请求来源无效。' : 'Invalid request origin.',
            code: 'INVALID_ORIGIN'
          },
          { status: 403 }
        )
    }
    const userId = await getCurrentUserId()
    if (!userId)
      return NextResponse.json(
        {
          error: locale === 'zh-CN' ? '请先登录。' : 'Sign in to use Tutor.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    return await handler(userId, locale)
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        {
          error:
            locale === 'zh-CN'
              ? '请检查提交的内容。'
              : 'Please check your submission.',
          code: 'INVALID_REQUEST'
        },
        { status: 400 }
      )
    if (error instanceof TutorRepositoryError || error instanceof TutorError) {
      const configurationError = [
        'TUTOR_NOT_CONFIGURED',
        'MODEL_NOT_CONFIGURED',
        'STORAGE_UNAVAILABLE'
      ].includes(error.code)
      return NextResponse.json(
        {
          error: translate(
            locale,
            configurationError ? AI_SERVICE_CONFIGURATION_ERROR : error.message
          ),
          code: error.code
        },
        { status: error.status }
      )
    }
    // Neither credentials, provider responses nor raw database errors reach the client.
    console.error(
      '[Tutor API]',
      error instanceof Error ? error.name : 'Unknown error'
    )
    return NextResponse.json(
      {
        error:
          locale === 'zh-CN'
            ? '暂时无法完成操作，请稍后重试。'
            : 'Unable to complete this action. Please try again.',
        code: 'TUTOR_UNAVAILABLE'
      },
      { status: 503 }
    )
  }
}

export async function readLimitedBody(request: NextRequest, maxBytes: number) {
  if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new TutorRepositoryError(
      'The request is too large.',
      'REQUEST_TOO_LARGE',
      413
    )
  const reader = request.body?.getReader()
  if (!reader)
    throw new TutorRepositoryError(
      'The request is empty.',
      'INVALID_REQUEST',
      400
    )
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new TutorRepositoryError(
          'The request is too large.',
          'REQUEST_TOO_LARGE',
          413
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

export async function readTutorJson(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new TutorRepositoryError(
      'Use a JSON request.',
      'INVALID_REQUEST',
      400
    )
  return JSON.parse(
    new TextDecoder().decode(await readLimitedBody(request, 64 * 1024))
  ) as unknown
}
