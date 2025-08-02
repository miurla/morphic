export interface StreamContext {
  chatId: string
  userId: string
  modelId: string
  messageId?: string
  trigger?: string
  initialChat: any
  abortSignal?: AbortSignal
}
