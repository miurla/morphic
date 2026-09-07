import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { captureClient } from '@/lib/analytics/posthog-client'

import { SidebarMenu, SidebarProvider } from '@/components/ui/sidebar'

import { LibraryMenuItem } from '../library-menu-item'

const libraryState = vi.hoisted(() => ({
  isOpen: false,
  toggleLibrary: vi.fn()
}))

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

vi.mock('@/components/library/library-context', () => ({
  useLibrary: () => libraryState
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}))

describe('LibraryMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    libraryState.isOpen = false
  })

  function renderItem() {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <LibraryMenuItem />
        </SidebarMenu>
      </SidebarProvider>
    )
  }

  test('opens the library and records the sidebar source', () => {
    renderItem()

    fireEvent.click(screen.getByRole('button', { name: 'Library' }))

    expect(libraryState.toggleLibrary).toHaveBeenCalledOnce()
    expect(captureClient).toHaveBeenCalledWith('library_opened', {
      source: 'sidebar'
    })
    expect(libraryState.toggleLibrary.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(captureClient).mock.invocationCallOrder[0]
    )
  })

  test('closes an open library and records the sidebar source', () => {
    libraryState.isOpen = true
    renderItem()

    fireEvent.click(screen.getByRole('button', { name: 'Library' }))

    expect(libraryState.toggleLibrary).toHaveBeenCalledOnce()
    expect(captureClient).toHaveBeenCalledWith('library_closed', {
      source: 'sidebar'
    })
  })
})
