import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { LibraryProvider, useLibrary } from '../library-context'

const sidebarState = vi.hoisted(() => ({
  isMobile: false,
  setOpen: vi.fn(),
  setOpenMobile: vi.fn()
}))

vi.mock('@/components/ui/sidebar', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/components/ui/sidebar')>()

  return {
    ...actual,
    useSidebar: () => sidebarState
  }
})

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}))

function LibraryHarness() {
  const { isOpen, openLibrary, toggleLibrary } = useLibrary()

  return (
    <>
      <button onClick={openLibrary}>Open library</button>
      <button onClick={toggleLibrary}>Toggle library</button>
      <output>{isOpen ? 'open' : 'closed'}</output>
    </>
  )
}

describe('LibraryProvider sidebar behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sidebarState.isMobile = false
  })

  function renderLibrary() {
    render(
      <SidebarProvider>
        <LibraryProvider>
          <LibraryHarness />
        </LibraryProvider>
      </SidebarProvider>
    )
  }

  test('opening the library closes the mobile sidebar surface', () => {
    sidebarState.isMobile = true
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Open library' }))

    expect(screen.getByText('open')).toBeInTheDocument()
    expect(sidebarState.setOpenMobile).toHaveBeenCalledWith(false)
    expect(sidebarState.setOpen).not.toHaveBeenCalled()
  })

  test('opening the library still closes the desktop sidebar surface', () => {
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Open library' }))

    expect(screen.getByText('open')).toBeInTheDocument()
    expect(sidebarState.setOpen).toHaveBeenCalledWith(false)
    expect(sidebarState.setOpenMobile).not.toHaveBeenCalled()
  })

  test('toggling the library open closes the mobile sidebar surface', () => {
    sidebarState.isMobile = true
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle library' }))

    expect(screen.getByText('open')).toBeInTheDocument()
    expect(sidebarState.setOpenMobile).toHaveBeenCalledWith(false)
    expect(sidebarState.setOpen).not.toHaveBeenCalled()
  })

  test('toggling the library closed leaves the sidebar surfaces alone', () => {
    sidebarState.isMobile = true
    renderLibrary()

    const toggle = screen.getByRole('button', { name: 'Toggle library' })
    fireEvent.click(toggle)
    vi.clearAllMocks()
    fireEvent.click(toggle)

    expect(screen.getByText('closed')).toBeInTheDocument()
    expect(sidebarState.setOpenMobile).not.toHaveBeenCalled()
    expect(sidebarState.setOpen).not.toHaveBeenCalled()
  })
})
