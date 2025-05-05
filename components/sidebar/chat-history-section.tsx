import { ClearHistory } from '@/components/clear-history'
import { SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar'
import { getChats } from '@/lib/actions/chat'
import { Chat } from '@/lib/types'
import { History } from 'lucide-react'
import { cache } from 'react'
import { ChatMenuItem } from './chat-menu-item'

const loadChats = cache(async (userId?: string) => {
  return await getChats(userId)
})

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  const chats = await loadChats('anonymous')

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroupLabel className="px-2 mb-2 flex items-center gap-1.5">
        <History size={14} />
        <span>History</span>
      </SidebarGroupLabel>
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
      <div className="p-2 mt-auto">
        <ClearHistory empty={!chats?.length} />
      </div>
    </div>
  )
}
