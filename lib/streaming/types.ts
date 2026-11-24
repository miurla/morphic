import { UIMessage } from '@ai-sdk/react'

import type { Locale } from '@/lib/i18n/config'

import { Model } from '../types/models'
import { SearchMode } from '../types/search'

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
  locale?: Locale
  spaceColor?: string
  onZeroPartError?: () => Promise<void>
}
