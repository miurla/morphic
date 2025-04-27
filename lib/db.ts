import Dexie, { Table } from 'dexie'
import { PmcResearchResultResponse } from '../types/pmc_research'

export interface Chat {
  id: string // Usaremos o threadId como ID do chat
  createdAt: Date
  title: string // Novo campo para o título do chat
  // Adicione outros metadados do chat aqui se necessário
}

export interface ChatMessage {
  id: string // Unique ID for the message (e.g., UUID)
  chatId: string // Foreign key linking to the ChatThread
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool' // Role of the message sender
  content: string // The actual text content of the message
  createdAt: Date // Timestamp when the message was created
  pmcResultData?: PmcResearchResultResponse
  thread_id?: string // Optional: Store the thread_id from the backend response for assistant messages
  // Potentially add other fields like name, tool_calls, etc. if needed later
}

export class ChatDB extends Dexie {
  chats!: Table<Chat>
  messages!: Table<ChatMessage>

  constructor() {
    super('ChatDatabase')
    this.version(1).stores({
      chats: '&id, createdAt', // Chave primária 'id' (threadId), indexado por createdAt
      messages: '++internalId, &[chatId+id], chatId, createdAt' // Chave primária auto-incrementada, chave única composta chatId+messageId, indexado por chatId
    })
    this.version(2)
      .stores({
        chats: '&id, createdAt, title', // Adiciona 'title' indexado (v2)
        messages: '++internalId, &[chatId+id], chatId, createdAt' // Mantém schema de mensagens
      })
      .upgrade(tx => {
        // Código de migração (opcional, mas bom para desenvolvimento)
        // Se precisar, pode adicionar lógica para preencher títulos antigos aqui
        console.log('Upgrading Dexie schema to version 2')
        // Exemplo: poderia tentar pegar a primeira msg de chats existentes e setar o título
        // return tx.table('chats').toCollection().modify(chat => {
        //    if (!chat.title) chat.title = 'Chat from v1';
        // });
      })
  }

  // Métodos para interagir com o DB (exemplos)

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return this.messages.where('chatId').equals(chatId).sortBy('createdAt')
  }

  async addChatMessage(message: ChatMessage): Promise<void> {
    await this.messages.add({
      ...message,
      createdAt: message.createdAt || new Date()
    })
  }

  async addChatMessages(messages: ChatMessage[]): Promise<void> {
    const messagesWithDate = messages.map(m => ({
      ...m,
      createdAt: m.createdAt || new Date()
    }))
    await this.messages.bulkAdd(messagesWithDate)
  }

  async createChat(chatId: string, title: string): Promise<void> {
    const existing = await this.chats.get(chatId)
    if (!existing) {
      await this.chats.add({ id: chatId, createdAt: new Date(), title })
    }
    // Se já existe, talvez queira atualizar o título? Por enquanto, não fazemos nada.
  }

  async listChats(): Promise<Chat[]> {
    return this.chats.orderBy('createdAt').reverse().toArray()
  }

  async clearChatMessages(chatId: string): Promise<void> {
    await this.messages.where('chatId').equals(chatId).delete()
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.transaction('rw', this.chats, this.messages, async () => {
      await this.messages.where('chatId').equals(chatId).delete()
      await this.chats.delete(chatId)
    })
  }

  async clearAllChats(): Promise<void> {
    await this.transaction('rw', this.chats, this.messages, async () => {
      await this.messages.clear()
      await this.chats.clear()
    })
  }

  async updateChatTitle(chatId: string, newTitle: string): Promise<void> {
    await this.chats.update(chatId, { title: newTitle })
  }
}

export const db = new ChatDB()
