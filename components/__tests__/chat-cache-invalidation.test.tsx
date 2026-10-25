import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearChats, deleteChat } from '@/lib/actions/chat'
import { chatStore } from '@/lib/chat-store'
import type { Chat } from '@/lib/db/schema'

import { ChatMenuItem } from '../sidebar/chat-menu-item'
import { ClearHistoryAction } from '../sidebar/clear-history-action'

vi.mock('@/lib/actions/chat', () => ({
  deleteChat: vi.fn(),
  clearChats: vi.fn()
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() })
}))
vi.mock('@/components/ui/alert-dialog', () => {
  const Container = ({ children }: any) => <div>{children}</div>
  const Button = ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  )
  return {
    AlertDialog: Container,
    AlertDialogContent: Container,
    AlertDialogDescription: Container,
    AlertDialogFooter: Container,
    AlertDialogHeader: Container,
    AlertDialogTitle: Container,
    AlertDialogTrigger: Container,
    AlertDialogCancel: Button,
    AlertDialogAction: Button
  }
})
vi.mock('@/components/ui/dropdown-menu', () => {
  const Container = ({ children }: any) => <div>{children}</div>
  return {
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuItem: Container,
    DropdownMenuTrigger: Container
  }
})
vi.mock('@/components/ui/sidebar', () => {
  const Container = ({ children }: any) => <div>{children}</div>
  return {
    SidebarMenuAction: Container,
    SidebarMenuButton: Container,
    SidebarMenuItem: Container,
    SidebarGroupAction: Container
  }
})

describe('chat cache invalidation actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatStore.clear()
    chatStore.getOrCreate('cached', { messages: [] })
  })

  it('removes a sidebar-deleted chat after success', async () => {
    vi.mocked(deleteChat).mockResolvedValue({ success: true })
    render(
      <ChatMenuItem
        chat={{ id: 'cached', title: 'Chat', createdAt: new Date() } as Chat}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(chatStore.get('cached')).toBeUndefined())
    expect(deleteChat).toHaveBeenCalledWith('cached')
  })

  it('clears the cache after clearing history', async () => {
    vi.mocked(clearChats).mockResolvedValue({ success: true })
    render(<ClearHistoryAction empty={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(chatStore.get('cached')).toBeUndefined())
    expect(clearChats).toHaveBeenCalledOnce()
  })

  it('retains history if the deletion fails', async () => {
    vi.mocked(clearChats).mockResolvedValue({ success: false, error: 'Failed' })
    render(<ClearHistoryAction empty={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(clearChats).toHaveBeenCalledOnce())
    expect(chatStore.get('cached')).toBeDefined()
  })
})
