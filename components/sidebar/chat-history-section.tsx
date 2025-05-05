import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu
} from '@/components/ui/sidebar'
import { getChats } from '@/lib/actions/chat'
import { Chat } from '@/lib/types'
import { cache } from 'react'
import { ChatMenuItem } from './chat-menu-item'
import { ClearHistoryAction } from './clear-history-action'

const loadChats = cache(async (userId?: string) => {
  return await getChats(userId)
})

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  // Replace with your own user ID
  const chats = await loadChats('anonymous')

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={!chats?.length} />
        </div>
      </SidebarGroup>
      <div className="flex-1 overflow-y-auto mb-2">
        {!chats?.length ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        ) : (
          <SidebarMenu>
            {chats.map(
              (chat: Chat) => chat && <ChatMenuItem key={chat.id} chat={chat} />
            )}
          </SidebarMenu>
        )}
      </div>
    </div>
  )
}
