import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { deleteCookie, getCookie, setCookie } from '@/lib/utils/cookies'

import { SearchModeSelector } from '../search-mode-selector'

describe('SearchModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteCookie('searchMode')
  })

  test('blocks adaptive selection when auth is required', () => {
    const onAdaptiveAuthRequired = vi.fn()
    setCookie('searchMode', 'quick')

    render(
      <SearchModeSelector
        isAdaptiveAuthRequired
        onAdaptiveAuthRequired={onAdaptiveAuthRequired}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /adaptive mode/i }))

    expect(onAdaptiveAuthRequired).toHaveBeenCalledTimes(1)
    expect(getCookie('searchMode')).toBe('quick')
  })

  test('allows adaptive selection when auth is not required', () => {
    const onAdaptiveAuthRequired = vi.fn()

    render(
      <SearchModeSelector onAdaptiveAuthRequired={onAdaptiveAuthRequired} />
    )

    fireEvent.click(screen.getByRole('button', { name: /adaptive mode/i }))

    expect(onAdaptiveAuthRequired).not.toHaveBeenCalled()
    expect(getCookie('searchMode')).toBe('adaptive')
  })

  test('resets a stale adaptive cookie when auth is required', async () => {
    setCookie('searchMode', 'adaptive')

    render(<SearchModeSelector isAdaptiveAuthRequired />)

    await waitFor(() => {
      expect(getCookie('searchMode')).toBe('quick')
    })
  })
})
