'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { type Chat } from '@/lib/types'
import { Redis } from '@upstash/redis'
import { Index } from '@upstash/vector'
import { custom, RAGChat } from '@upstash/rag-chat'
import { aiUseChatAdapter } from '@upstash/rag-chat/nextjs'
import { getModel } from '@/lib/utils'


// Initialize RAGChat
export const ragChat = new RAGChat({
  model: custom(getModel().modelId),
  debug: true // Enable debugging
})

// Function to embed data into the RAGChat context
export async function embedData(filePath: string) {
  await ragChat.context.add({
    type: 'pdf',
    fileSource: filePath,
    options: {
      metadata: {
        source: filePath
      }
    }
  })
}

// Function to handle chat requests
export async function POST(req: Request) {
  const { messages } = await req.json()
  const lastMessage = messages[messages.length - 1].content

  const response = await ragChat.chat(lastMessage, {
    streaming: true,
    history: messages
      .slice(0, -1)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      }))
  })

  return aiUseChatAdapter(response)
}

// Function to get chat history
export async function getChats(userId: string) {
  return ragChat.history.service.getMessages({
    sessionId: userId
  })
}

// Function to clear chat history
export async function clearChats(userId: string) {
  await ragChat.history.service.deleteMessages({ sessionId: userId })
  return { success: true }
}

// Example of how to use the chat in a Next.js API route
export async function chatHandler(req: Request) {
  if (req.method === 'POST') {
    const { message, userId } = await req.json()

    const response = await ragChat.chat(message, {
      streaming: true,
      sessionId: userId
    })

    return new Response(response.output)
  } else {
    return new Response('Method not allowed', { status: 405 })
  }
}

// Function to share a chat for a specific user
// Function to save a chat for a specific user
export async function saveChat(chat: Chat, userId: string = 'anonymous') {
  const messages = chat.messages.map(msg => ({
    role:
      msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'assistant',
    content: msg.content
  }))

  for (const message of messages) {
    await ragChat.history.service.addMessage({
      sessionId: userId,
      message: message
    })
  }

  return { success: true, chatId: chat.id }
}

// Function to share a chat for a specific user
export async function shareChat(chatId: string, userId: string = 'anonymous') {
  const messages = await ragChat.history.service.getMessages({
    sessionId: userId
  })

  if (!messages || messages.length === 0) {
    return null
  }

  const sharePath = `/share/${chatId}`

  // Update the last message with the share path
  const lastMessageIndex = messages.length - 1
  const updatedLastMessage = {
    ...messages[lastMessageIndex],
    metadata: { ...messages[lastMessageIndex].metadata, sharePath }
  }

  // Update the last message in the history service
  await ragChat.history.service.addMessage({
    sessionId: userId,
    message: updatedLastMessage
  })

  // Update the messages array
  messages[lastMessageIndex] = updatedLastMessage

  return {
    id: chatId,
    userId,
    messages,
    sharePath
  }
}

// Function to get a shared chat by its ID
export async function getSharedChat(id: string) {
  const messages = await ragChat.history.service.getMessages({ sessionId: id })

  if (!messages || messages.length === 0) {
    return null
  }

  const lastMessage = messages[messages.length - 1]
  if (!lastMessage.metadata?.sharePath) {
    return null // Return null if the chat is not shared
  }

  return {
    id,
    messages,
    sharePath: lastMessage.metadata.sharePath
  }
}
