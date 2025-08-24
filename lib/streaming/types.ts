import { UIMessage } from '@ai-sdk/react'

import { SearchMode } from '../agents/researcher'
import { Model } from '../types/models'

export interface BaseStreamConfig {
  message: UIMessage | null
  model: Model
  chatId: string
  userId: string
  trigger?: 'submit-user-message' | 'regenerate-assistant-message'
  messageId?: string
  abortSignal?: AbortSignal
  isNewChat?: boolean
  searchMode?: SearchMode
}
