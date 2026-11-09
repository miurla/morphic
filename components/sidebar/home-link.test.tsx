import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { SHORTCUT_EVENTS } from '@/lib/keyboard-shortcuts'

import { HomeLink } from './home-link'
import { NewChatMenuItem } from './new-chat-menu-item'

vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('next/link', () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  )
}))

describe('HomeLink', () => {
  afterEach(() => vi.restoreAllMocks())

  test('resets the active chat before navigating home', () => {
    const reset = vi.fn((event: Event) => event.preventDefault())
    window.addEventListener(SHORTCUT_EVENTS.newChat, reset, { once: true })
    render(<NewChatMenuItem />)

    const navigate = fireEvent.click(screen.getByRole('link', { name: 'New' }))

    expect(reset).toHaveBeenCalledOnce()
    expect(navigate).toBe(false)
  })

  test('keeps home navigation when no chat handles the event', () => {
    render(<NewChatMenuItem />)

    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(fireEvent.click(screen.getByRole('link', { name: 'New' }))).toBe(
      true
    )
  })

  test.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'])(
    'keeps modified link clicks with %s from resetting the current chat',
    modifier => {
      const reset = vi.fn()
      window.addEventListener(SHORTCUT_EVENTS.newChat, reset)
      try {
        render(<NewChatMenuItem />)
        fireEvent.click(screen.getByRole('link', { name: 'New' }), {
          [modifier]: true
        })
        expect(reset).not.toHaveBeenCalled()
      } finally {
        window.removeEventListener(SHORTCUT_EVENTS.newChat, reset)
      }
    }
  )

  test('resets the active chat from the sidebar logo too', () => {
    const reset = vi.fn((event: Event) => event.preventDefault())
    window.addEventListener(SHORTCUT_EVENTS.newChat, reset, { once: true })
    render(<HomeLink>Morphic</HomeLink>)

    const navigate = fireEvent.click(
      screen.getByRole('link', { name: 'Morphic' })
    )

    expect(reset).toHaveBeenCalledOnce()
    expect(navigate).toBe(false)
  })
})
