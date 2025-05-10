import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { ChatHistoryClient } from './chat-history-client'

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
        </div>
      </SidebarGroup>
      <ChatHistoryClient />
    </div>
  )
}
