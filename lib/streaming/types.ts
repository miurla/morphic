import { Message } from 'ai'

export interface BaseStreamConfig {
  messages: Message[]
  model: string
  chatId: string
  searchMode: boolean
}
