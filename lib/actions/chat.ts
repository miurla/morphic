'use server'

import { type Chat } from '@/lib/types'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
})

export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  try {
    const pipeline = redis.pipeline()
    const chats: string[] = await redis.zrange(`user:chat:${userId}`, 0, -1, {
      rev: true
    })

    for (const chat of chats) {
      pipeline.hgetall(chat)
    }

    const results = await pipeline.exec()

    return results as Chat[]
  } catch (error) {
    return []
  }
}

export async function getChat(id: string, userId: string = 'anonymous') {
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat) {
    return null
  }

  return chat
}

export async function saveChat(chat: Chat, userId: string = 'anonymous') {
  const pipeline = redis.pipeline()
  pipeline.hmset(`chat:${chat.id}`, chat)
  pipeline.zadd(`user:chat:${chat.userId}`, {
    score: Date.now(),
    member: `chat:${chat.id}`
  })
  await pipeline.exec()
}
