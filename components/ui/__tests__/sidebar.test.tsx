import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { captureClient } from '@/lib/analytics/posthog-client'

import { SidebarProvider, useSidebar } from '../sidebar'

const viewport = vi.hoisted(() => ({ isMobile: false }))

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => viewport.isMobile
}))

function ToggleHarness() {
  const { toggleSidebar } = useSidebar()

  return <button onClick={toggleSidebar}>Toggle sidebar</button>
}

describe('SidebarProvider analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = 'sidebar_state=; max-age=0; path=/'
  })

  test.each([
    { isMobile: false, label: 'desktop' },
    { isMobile: true, label: 'mobile' }
  ])('records the new open value on $label', ({ isMobile }) => {
    viewport.isMobile = isMobile
    render(
      <SidebarProvider defaultOpen={false}>
        <ToggleHarness />
      </SidebarProvider>
    )

    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)

    expect(captureClient).toHaveBeenNthCalledWith(1, 'sidebar_toggled', {
      open: true,
      isMobile
    })
    expect(captureClient).toHaveBeenNthCalledWith(2, 'sidebar_toggled', {
      open: false,
      isMobile
    })
  })
})
