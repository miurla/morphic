import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { getChatsPage } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { ChatHistoryClient } from './chat-history-client'
import { ClearHistoryAction } from './clear-history-action'

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  // Fetch the initial page of chats
  const userId = await getCurrentUserId()
  const { chats, nextOffset } = await getChatsPage(userId, 20, 0)

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={!chats?.length && !nextOffset} />
        </div>
      </SidebarGroup>
      <ChatHistoryClient initialChats={chats} initialNextOffset={nextOffset} />
    </div>
  )
}
