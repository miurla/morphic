import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import AppSidebar from '../app-sidebar'

vi.mock('../sidebar/chat-history-section', () => ({
  ChatHistorySection: () => <div />
}))

vi.mock('../sidebar/chat-history-skeleton', () => ({
  ChatHistorySkeleton: () => <div />
}))

vi.mock('../sidebar/new-chat-menu-item', () => ({
  NewChatMenuItem: () => <div>New</div>
}))

vi.mock('../sidebar/library-menu-item', () => ({
  LibraryMenuItem: () => <div>Library</div>
}))

vi.mock('../sidebar/version-footer', () => ({
  VersionFooter: () => <div>Version footer</div>
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}))

function renderSidebar() {
  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  )
}

describe('AppSidebar library entry', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('shows the Library entry when authentication is enabled', () => {
    vi.stubEnv('ENABLE_AUTH', 'true')
    renderSidebar()

    expect(screen.getByText('Library')).toBeInTheDocument()
  })

  test('hides the Library entry in anonymous mode', () => {
    vi.stubEnv('ENABLE_AUTH', 'false')
    renderSidebar()

    expect(screen.queryByText('Library')).not.toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  test('hides the Library entry when AUTH_PROVIDER=none with ENABLE_AUTH unset', () => {
    vi.stubEnv('AUTH_PROVIDER', 'none')
    renderSidebar()

    expect(screen.queryByText('Library')).not.toBeInTheDocument()
  })
})

describe('AppSidebar version footer', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('shows the version footer by default', () => {
    renderSidebar()

    expect(screen.getByText('Version footer')).toBeInTheDocument()
  })

  test('hides the version footer when MORPHIC_VERSION_FOOTER_DISABLED=true', () => {
    vi.stubEnv('MORPHIC_VERSION_FOOTER_DISABLED', 'true')
    renderSidebar()

    expect(screen.queryByText('Version footer')).not.toBeInTheDocument()
  })
})
