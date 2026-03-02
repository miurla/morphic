import type { Chat, Message } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

export interface StreamContext {
  chatId: string
  userId: string
  modelId: string
  messageId?: string
  trigger?: string
  initialChat: (Chat & { messages: UIMessage[] }) | null
  abortSignal?: AbortSignal
  parentTraceId?: string
  isNewChat?: boolean
  pendingInitialSave?: Promise<{ chat: Chat; message: Message }>
  pendingInitialUserMessage?: UIMessage
}
