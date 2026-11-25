import { useEffect, useState } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatArtifactContainer } from '@/components/artifact/chat-artifact-container'

const layout = vi.hoisted(() => ({
  pathname: '/tutor',
  mobile: false,
  open: false,
  library: false
}))
vi.mock('next/navigation', () => ({ usePathname: () => layout.pathname }))
vi.mock('@/lib/contexts/user-context', () => ({ useHasUser: () => true }))
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ open: layout.open, isMobile: layout.mobile }),
  SidebarTrigger: () => <button>Toggle sidebar</button>
}))
vi.mock('@/components/artifact/artifact-context', () => ({
  useArtifact: () => ({ state: { isOpen: false, part: null } })
}))
vi.mock('@/components/library/library-context', () => ({
  useLibrary: () => ({ isOpen: layout.library })
}))
vi.mock('@/components/library/library-panel', () => ({
  LibraryPanel: () => <div>Library panel</div>
}))
vi.mock('@/components/inspector/inspector-panel', () => ({
  InspectorPanel: () => null
}))
vi.mock('@/components/inspector/inspector-drawer', () => ({
  InspectorDrawer: () => null
}))

describe('Tutor responsive container', () => {
  beforeEach(() => {
    layout.pathname = '/tutor'
    layout.mobile = false
    layout.open = false
    layout.library = false
  })

  it('keeps one form mounted when the viewport or sidebar changes', () => {
    const mount = vi.fn()
    function Form() {
      const [draft, setDraft] = useState('')
      useEffect(() => {
        mount()
      }, [])
      return (
        <input
          aria-label="Learning goal"
          value={draft}
          onChange={event => setDraft(event.target.value)}
        />
      )
    }
    const { rerender } = render(
      <ChatArtifactContainer>
        <Form />
      </ChatArtifactContainer>
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Keep my goal' }
    })
    layout.mobile = true
    layout.open = true
    rerender(
      <ChatArtifactContainer>
        <Form />
      </ChatArtifactContainer>
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toHaveValue('Keep my goal')
    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('supports nested tutor routes and retains the library surface', () => {
    layout.pathname = '/tutor/course-1'
    layout.library = true
    render(
      <ChatArtifactContainer>
        <p>Tutor content</p>
      </ChatArtifactContainer>
    )
    expect(screen.getAllByText('Tutor content')).toHaveLength(1)
    expect(screen.getByText('Library panel')).toBeInTheDocument()
  })
})
