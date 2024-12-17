'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { type Chat } from '@/lib/types'
import { getRedisClient, RedisWrapper } from '@/lib/redis/config'
import { getStorageProvider } from '@/lib/storage'

async function getRedis(): Promise<RedisWrapper> {
  return await getRedisClient()
}

export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  try {
    const redis = await getRedis()
    const chatHistoryEnabled = await redis.get(
      `user:${userId}:chatHistoryEnabled`
    )

    if (chatHistoryEnabled === 'false') {
      return []
    }

    const chats = await redis.zrange(`user:chat:${userId}`, 0, -1, {
      rev: true
    })

    if (chats.length === 0) {
      return []
    }

    const results = await Promise.all(
      chats.map(async chatKey => {
        const chat = await redis.hgetall(chatKey)
        return chat
      })
    )

    return results
      .filter((result): result is Record<string, any> => {
        if (result === null || Object.keys(result).length === 0) {
          return false
        }
        return true
      })
      .map(chat => {
        const plainChat = { ...chat }
        if (typeof plainChat.messages === 'string') {
          try {
            plainChat.messages = JSON.parse(plainChat.messages)
          } catch (error) {
            plainChat.messages = []
          }
        }
        if (plainChat.createdAt && !(plainChat.createdAt instanceof Date)) {
          plainChat.createdAt = new Date(plainChat.createdAt)
        }
        return plainChat as Chat
      })
  } catch (error) {
    console.error('Error fetching chats:', error)
    return []
  }
}

export async function getChat(id: string, userId: string = 'anonymous') {
  const redis = await getRedis()
  const chatHistoryEnabled = await redis.get(
    `user:${userId}:chatHistoryEnabled`
  )

  if (chatHistoryEnabled === 'false') {
    return null
  }

  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat) {
    return null
  }

  // Parse the messages if they're stored as a string
  if (typeof chat.messages === 'string') {
    try {
      chat.messages = JSON.parse(chat.messages)
    } catch (error) {
      chat.messages = []
    }
  }

  // Ensure messages is always an array
  if (!Array.isArray(chat.messages)) {
    chat.messages = []
  }

  return chat
}

export async function clearChats(
  userId: string = 'anonymous'
): Promise<{ error?: string }> {
  const redis = await getRedis()
  const chatHistoryEnabled = await redis.get(
    `user:${userId}:chatHistoryEnabled`
  )

  if (chatHistoryEnabled === 'false') {
    return { error: 'Chat history is disabled' }
  }

  const chats = await redis.zrange(`user:chat:${userId}`, 0, -1)
  if (!chats.length) {
    return { error: 'No chats to clear' }
  }
  const pipeline = redis.pipeline()

  for (const chat of chats) {
    pipeline.del(chat)
    pipeline.zrem(`user:chat:${userId}`, chat)
  }

  await pipeline.exec()
  revalidatePath('/')
  return {}
}

export async function saveChat(chat: Chat, userId: string = 'anonymous') {
  try {
    const redis = await getRedis()
    const chatHistoryEnabled = await redis.get(
      `user:${userId}:chatHistoryEnabled`
    )

    //strict string comparison and early return if chat history is disabled
    if (chatHistoryEnabled === 'false' || chatHistoryEnabled === null) {
      return null
    }

    const pipeline = redis.pipeline()

    const chatToSave = {
      ...chat,
      messages: JSON.stringify(chat.messages)
    }

    pipeline.hmset(`chat:${chat.id}`, chatToSave)
    pipeline.zadd(`user:chat:${userId}`, Date.now(), `chat:${chat.id}`)

    const results = await pipeline.exec()

    return results
  } catch (error) {
    console.error('Error saving chat:', error)
    throw error
  }
}

export async function getSharedChat(id: string) {
  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat || !chat.sharePath) {
    return null
  }

  return chat
}

export async function shareChat(id: string, userId: string = 'anonymous') {
  const redis = await getRedis()
  const chatHistoryEnabled = await redis.get(
    `user:${userId}:chatHistoryEnabled`
  )

  if (chatHistoryEnabled === 'false') {
    return null
  }

  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat || chat.userId !== userId) {
    return null
  }

  const payload = {
    ...chat,
    sharePath: `/share/${id}`
  }

  await redis.hmset(`chat:${id}`, payload)

  return payload
}

export async function updateChatHistorySetting(
  userId: string,
  enabled: boolean
) {
  try {
    const redis = await getRedisClient()
    // Always store as string 'true' or 'false'
    const result = await redis.set(
      `user:${userId}:chatHistoryEnabled`,
      String(enabled)
    )
    return result === 'OK'
  } catch (error) {
    console.error('Error updating chat history setting:', error)
    return false
  }
}

export async function getChatHistorySetting(userId: string): Promise<boolean> {
  try {
    const redis = await getRedisClient()

    // Return false if storage is disabled
    if (redis.shouldSkipOperation()) {
      return false
    }

    const value = await redis.get(`user:${userId}:chatHistoryEnabled`)
    return value !== 'false'
  } catch (error) {
    console.error('Error getting chat history setting:', error)
    return false
  }
}
