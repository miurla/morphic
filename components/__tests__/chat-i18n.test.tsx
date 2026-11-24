import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActionButtons } from '@/components/action-buttons'
import { LanguageProvider, useI18n } from '@/components/language-provider'
import { PastedContentCard } from '@/components/pasted-parts'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() })
}))

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

function SwitchLanguage() {
  const { setPreference } = useI18n()
  return <button onClick={() => setPreference('en')}>Switch to English</button>
}

describe('chat interface language', () => {
  it('submits the displayed Chinese example rather than its English source', () => {
    const selectPrompt = vi.fn()
    const selectCategory = vi.fn()
    render(
      <LanguageProvider initialLocale="zh-CN" initialPreference="zh-CN">
        <ActionButtons
          onSelectPrompt={selectPrompt}
          onCategoryClick={selectCategory}
        />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '理解原理' }))
    expect(selectCategory).toHaveBeenCalledWith('理解原理')
    fireEvent.click(screen.getByRole('button', { name: '极光是如何形成的？' }))
    expect(selectPrompt).toHaveBeenCalledWith('极光是如何形成的？')
  })

  it('preserves expanded pasted content while its label changes language', () => {
    const content = 'This is user-provided content and must stay unchanged.'
    render(
      <LanguageProvider initialLocale="zh-CN" initialPreference="zh-CN">
        <SwitchLanguage />
        <PastedContentCard text={content} />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /粘贴内容/ }))
    expect(screen.getByText(content)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(
      screen.getByRole('button', { name: /Pasted content/ })
    ).toBeInTheDocument()
    expect(screen.getByText(content)).toBeInTheDocument()
  })
})
