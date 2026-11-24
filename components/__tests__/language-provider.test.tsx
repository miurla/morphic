import { useState } from 'react'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LANGUAGE_COOKIE } from '@/lib/i18n/config'

import { LanguageProvider, useI18n } from '../language-provider'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function Probe() {
  const { t, locale, preference, setPreference } = useI18n()
  const [draft, setDraft] = useState('')
  return (
    <>
      <p>{t('Account')}</p>
      <output>
        {locale}:{preference}
      </output>
      <input
        aria-label="Draft"
        value={draft}
        onChange={event => setDraft(event.target.value)}
      />
      <button onClick={() => setPreference('zh-CN')}>中文</button>
      <button onClick={() => setPreference('en')}>English</button>
      <button onClick={() => setPreference('auto')}>Auto</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie = `${LANGUAGE_COOKIE}=;max-age=0;path=/`
})

describe('LanguageProvider', () => {
  it('renders the server-selected language immediately', () => {
    render(
      <LanguageProvider initialLocale="zh-CN" initialPreference="zh-CN">
        <Probe />
      </LanguageProvider>
    )
    expect(screen.getByText('账户')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('zh-CN')
  })
  it('changes labels, persists preference and preserves unsent input', () => {
    render(
      <LanguageProvider initialLocale="en" initialPreference="auto">
        <Probe />
      </LanguageProvider>
    )
    fireEvent.change(screen.getByLabelText('Draft'), {
      target: { value: 'Unsent message' }
    })
    fireEvent.click(screen.getByText('中文'))
    expect(screen.getByText('账户')).toBeInTheDocument()
    expect(document.cookie).toContain(`${LANGUAGE_COOKIE}=zh-CN`)
    expect(screen.getByLabelText('Draft')).toHaveValue('Unsent message')
    expect(refresh).toHaveBeenCalled()
    fireEvent.click(screen.getByText('English'))
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })
  it('resolves follow-browser to a supported locale', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN', 'en'])
    render(
      <LanguageProvider initialLocale="en" initialPreference="en">
        <Probe />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByText('Auto'))
    expect(screen.getByText('zh-CN:auto')).toBeInTheDocument()
    expect(document.cookie).toContain(`${LANGUAGE_COOKIE}=auto`)
  })
  it('adopts another tab’s preference on focus without losing the draft', () => {
    render(
      <LanguageProvider initialLocale="en" initialPreference="en">
        <Probe />
      </LanguageProvider>
    )
    fireEvent.change(screen.getByLabelText('Draft'), {
      target: { value: 'Keep this draft' }
    })
    document.cookie = `${LANGUAGE_COOKIE}=zh-CN;path=/`
    fireEvent(window, new Event('focus'))
    expect(screen.getByText('账户')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this draft')
  })
})
