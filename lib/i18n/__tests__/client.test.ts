import { afterEach, describe, expect, it } from 'vitest'

import { getClientLocale } from '../client'

const initialLang = document.documentElement.lang
afterEach(() => {
  document.documentElement.lang = initialLang
})

describe('getClientLocale', () => {
  it('reads the currently rendered language every time a request is sent', () => {
    document.documentElement.lang = 'zh-CN'
    expect(getClientLocale()).toBe('zh-CN')
    document.documentElement.lang = 'en'
    expect(getClientLocale()).toBe('en')
  })

  it('does not send unsupported document languages to the prompt', () => {
    document.documentElement.lang = 'fr'
    expect(getClientLocale()).toBe('en')
  })
})
