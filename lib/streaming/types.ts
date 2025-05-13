import { Message } from 'ai'
import { Model } from '../types/models'

export interface BaseStreamConfig {
  message: Message
  model: Model
  chatId: string
  searchMode: boolean
  userId: string
}
