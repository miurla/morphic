import { UIMessage } from '@ai-sdk/react'

import { Model } from '../types/models'

export interface BaseStreamConfig {
  message: UIMessage | null
  model: Model
  chatId: string
  searchMode: boolean
  userId: string
  trigger?: 'submit-user-message' | 'regenerate-assistant-message'
  messageId?: string
  abortSignal?: AbortSignal
}
