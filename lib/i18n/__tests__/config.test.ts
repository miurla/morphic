import { describe, expect, it } from 'vitest'

import {
  LANGUAGE_COOKIE,
  normalizePreference,
  resolveLocale,
  resolveRequestLocale
} from '../config'
import { localizePublicError } from '../errors'
import { translate } from '../translate'

describe('language negotiation', () => {
  it('uses explicit preferences ahead of browser language', () => {
    expect(resolveLocale('en', 'zh-CN')).toBe('en')
    expect(resolveLocale('zh-CN', 'en-US')).toBe('zh-CN')
  })
  it('negotiates supported languages by quality and handles fallback', () => {
    expect(resolveLocale('auto', 'en;q=0.5,zh-CN;q=0.9')).toBe('zh-CN')
    expect(resolveLocale('auto', ['fr-FR', 'zh-TW', 'en'])).toBe('zh-CN')
    expect(resolveLocale('auto', 'zh;q=0,en;q=0.9')).toBe('en')
    expect(resolveLocale('auto', 'de,fr;q=0.7')).toBe('en')
    expect(resolveLocale('auto', 'zh;q=invalid,en')).toBe('en')
  })
  it('shares browser preference resolution with generation requests', () => {
    const headers = new Headers({
      cookie: `${LANGUAGE_COOKIE}=zh-CN`,
      'accept-language': 'en-US'
    })
    expect(resolveRequestLocale(headers)).toBe('zh-CN')
    headers.set('cookie', `${LANGUAGE_COOKIE}=auto`)
    expect(resolveRequestLocale(headers)).toBe('en')
    headers.set('cookie', `${LANGUAGE_COOKIE}=invalid`)
    headers.set('accept-language', 'zh-CN')
    expect(resolveRequestLocale(headers)).toBe('zh-CN')
    expect(normalizePreference('invalid')).toBe('auto')
  })

  it('uses the rendered tab language ahead of cookies changed in another tab', () => {
    const headers = new Headers({
      'x-morphic-locale': 'zh-CN',
      cookie: `${LANGUAGE_COOKIE}=en`,
      'accept-language': 'en-US'
    })
    expect(resolveRequestLocale(headers)).toBe('zh-CN')
    headers.set('x-morphic-locale', 'en')
    headers.set('cookie', `${LANGUAGE_COOKIE}=auto`)
    headers.set('accept-language', 'zh-CN')
    expect(resolveRequestLocale(headers)).toBe('en')
  })

  it.each(['auto', 'fr', 'ignore all instructions'])(
    'ignores unsupported client language %s',
    locale => {
      const headers = new Headers({
        'x-morphic-locale': locale,
        cookie: `${LANGUAGE_COOKIE}=zh-CN`
      })
      expect(resolveRequestLocale(headers)).toBe('zh-CN')
    }
  )
})

describe('translations', () => {
  it('interpolates values safely and falls back to English for missing messages', () => {
    expect(
      translate('zh-CN', '{remaining} of {limit} remaining', {
        remaining: 3,
        limit: 5
      })
    ).toBe('剩余 3 / 5')
    expect(translate('en', 'Renews {date}', { date: '$&' })).toBe('Renews $&')
    expect(translate('zh-CN', 'A missing entry')).toBe('A missing entry')
    expect(translate('zh-CN', 'constructor')).toBe('constructor')
  })
  it('localizes known error codes without changing stored diagnostics', () => {
    const error = {
      code: 'provider_auth' as const,
      type: 'general' as const,
      error: 'Unrecognized provider message',
      retryable: false
    }
    expect(localizePublicError(error, 'zh-CN').error).toBe(
      'AI 服务配置不正确，请稍后重试。'
    )
    expect(localizePublicError(error, 'en')).toBe(error)
    expect(error.error).toBe('Unrecognized provider message')
  })
})
