import { UIMessage } from '@ai-sdk/react'

import { Model } from '../types/models'

export interface BaseStreamConfig {
  message: UIMessage
  model: Model
  chatId: string
  searchMode: boolean
  userId: string
}
