'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  Chat,
  mapChatRow,
  mapMessageRow,
  mapPartInsertToRow,
  mapPartRow
} from '@/lib/supabase/types'
import type { UIMessage } from '@/lib/types/ai'
import type {
  DBMessagePart,
  PersistableUIMessage
} from '@/lib/types/message-persistence'
import { generateId } from '@/lib/utils/id'
import {
  buildUIMessageFromDB,
  mapUIMessagePartsToDBParts,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { incrementDbOperationCount } from '@/lib/utils/perf-tracking'

// ---- Chat queries ----

export async function createChat({
  id = generateId(),
  title,
  userId,
  visibility = 'private'
}: {
  id?: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('chats')
    .insert({ id, title, user_id: userId, visibility })
    .select()
    .single()
  if (error) throw error
  return mapChatRow(data)
}

export async function getChat(
  chatId: string,
  userId?: string
): Promise<Chat | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single()

  if (error || !data) return null

  const chat = mapChatRow(data)

  if (chat.visibility === 'public') return chat
  if (chat.visibility === 'private' && userId && chat.userId === userId)
    return chat

  return null
}

export async function getChats(userId: string): Promise<Chat[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapChatRow)
}

export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const results = (data ?? []).map(mapChatRow)
    const nextOffset = results.length === limit ? offset + limit : null

    return { chats: results, nextOffset }
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Verify ownership
    const { data: chat } = await supabase
      .from('chats')
      .select('user_id')
      .eq('id', chatId)
      .single()

    if (!chat || chat.user_id !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase.from('chats').delete().eq('id', chatId)
    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    return { success: false, error: 'Failed to delete chat' }
  }
}

export async function updateChatVisibility(
  chatId: string,
  userId: string,
  visibility: 'public' | 'private'
): Promise<Chat | null> {
  const chat = await getChat(chatId, userId)
  if (!chat || chat.userId !== userId) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('chats')
    .update({ visibility })
    .eq('id', chatId)
    .select()
    .single()

  if (error || !data) return null
  return mapChatRow(data)
}

export async function updateChatTitle(
  chatId: string,
  title: string,
  userId?: string
): Promise<Chat | null> {
  const supabase = createAdminClient()
  let query = supabase.from('chats').update({ title }).eq('id', chatId)

  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query.select().single()
  if (error || !data) return null
  return mapChatRow(data)
}

// ---- Message queries ----

export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  _userId?: string
): Promise<{
  id: string
  chatId: string
  role: string
  createdAt: Date
  updatedAt: Date | null
  metadata: Record<string, any> | null
}> {
  const count = incrementDbOperationCount()
  perfLog(`DB - upsertMessage called - count: ${count}`)

  const supabase = createAdminClient()
  const messageData = mapUIMessageToDBMessage(message)

  // 1. Upsert message row
  const { data: dbMessage, error: msgError } = await supabase
    .from('messages')
    .upsert({
      id: messageData.id,
      chat_id: messageData.chatId,
      role: messageData.role,
      metadata: messageData.metadata ?? null
    })
    .select()
    .single()

  if (msgError) throw msgError

  // 2. Delete existing parts
  await supabase.from('parts').delete().eq('message_id', message.id)

  // 3. Insert new parts
  if (message.parts && message.parts.length > 0) {
    const dbParts = mapUIMessagePartsToDBParts(
      message.parts as any[],
      message.id
    )
    if (dbParts.length > 0) {
      const rows = dbParts.map((p: DBMessagePart) =>
        mapPartInsertToRow({ ...p, messageId: p.messageId } as any)
      )
      const { error: partsError } = await supabase.from('parts').insert(rows)
      if (partsError) throw partsError
    }
  }

  return mapMessageRow(dbMessage)
}

export async function loadChat(
  chatId: string,
  _userId?: string
): Promise<UIMessage[]> {
  const supabase = createAdminClient()

  const { data: msgs, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (msgError) throw msgError
  if (!msgs || msgs.length === 0) return []

  const messageIds = msgs.map((m: any) => m.id)
  const { data: partsData, error: partsError } = await supabase
    .from('parts')
    .select('*')
    .in('message_id', messageIds)
    .order('order', { ascending: true })

  if (partsError) throw partsError

  const partsByMessageId = ((partsData ?? []) as any[]).reduce(
    (acc: Record<string, any[]>, part: any) => {
      const mid = part.message_id
      if (!acc[mid]) acc[mid] = []
      acc[mid].push(mapPartRow(part))
      return acc
    },
    {} as Record<string, any[]>
  )

  return msgs.map((msg: any) =>
    buildUIMessageFromDB(mapMessageRow(msg), partsByMessageId[msg.id] ?? [])
  )
}

export async function loadChatWithMessages(
  chatId: string,
  userId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const count = incrementDbOperationCount()
  perfLog(`DB - loadChatWithMessages called - count: ${count}`)

  const supabase = createAdminClient()

  const [{ data: chatData }, { data: msgs, error: msgError }] =
    await Promise.all([
      supabase.from('chats').select('*').eq('id', chatId).single(),
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
    ])

  if (!chatData) return null
  const chat = mapChatRow(chatData)

  if (chat.visibility === 'private' && (!userId || chat.userId !== userId)) {
    return null
  }

  if (msgError) throw msgError

  if (!msgs || msgs.length === 0) return { ...chat, messages: [] }

  const messageIds = (msgs as any[]).map((m: any) => m.id)
  const { data: partsData, error: partsError } = await supabase
    .from('parts')
    .select('*')
    .in('message_id', messageIds)
    .order('order', { ascending: true })

  if (partsError) throw partsError

  const partsByMessageId = ((partsData ?? []) as any[]).reduce(
    (acc: Record<string, any[]>, part: any) => {
      const mid = part.message_id
      if (!acc[mid]) acc[mid] = []
      acc[mid].push(mapPartRow(part))
      return acc
    },
    {} as Record<string, any[]>
  )

  const uiMessages = (msgs as any[]).map((msg: any) =>
    buildUIMessageFromDB(mapMessageRow(msg), partsByMessageId[msg.id] ?? [])
  )

  return { ...chat, messages: uiMessages }
}

export async function deleteMessagesAfter(
  chatId: string,
  messageId: string,
  _userId?: string
): Promise<{ count: number }> {
  const supabase = createAdminClient()

  // Get the target message's timestamp
  const { data: target } = await supabase
    .from('messages')
    .select('created_at')
    .eq('id', messageId)
    .single()

  if (!target) return { count: 0 }

  const { data: toDelete } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_id', chatId)
    .gt('created_at', target.created_at)

  const ids = (toDelete ?? []).map((m: any) => m.id)
  if (ids.length === 0) return { count: 0 }

  await supabase.from('messages').delete().in('id', ids)

  return { count: ids.length }
}

export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  _userId?: string
): Promise<{ count: number }> {
  const supabase = createAdminClient()

  const { data: allMessages } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (!allMessages) return { count: 0 }

  const messageIndex = allMessages.findIndex((m: any) => m.id === messageId)
  if (messageIndex === -1) return { count: 0 }

  const toDelete = allMessages.slice(messageIndex)
  const ids = toDelete.map((m: any) => m.id)
  if (ids.length === 0) return { count: 0 }

  await supabase.from('messages').delete().in('id', ids)

  return { count: ids.length }
}

export async function createChatWithFirstMessageTransaction({
  chatId,
  chatTitle,
  userId,
  message
}: {
  chatId: string
  chatTitle: string
  userId: string
  message: PersistableUIMessage
}): Promise<{
  chat: Chat
  message: {
    id: string
    chatId: string
    role: string
    createdAt: Date
    updatedAt: Date | null
    metadata: Record<string, any> | null
  }
}> {
  perfLog(`DB - createChatWithFirstMessageTransaction start`)
  const dbStart = performance.now()

  const supabase = createAdminClient()

  // 1. Create chat
  const { data: chatData, error: chatError } = await supabase
    .from('chats')
    .insert({
      id: chatId,
      title: chatTitle.substring(0, 255),
      user_id: userId,
      visibility: 'private'
    })
    .select()
    .single()

  if (chatError) throw chatError

  // 2. Save message
  const dbMsg = mapUIMessageToDBMessage({ ...message, chatId })
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert({
      id: dbMsg.id,
      chat_id: dbMsg.chatId,
      role: dbMsg.role,
      metadata: dbMsg.metadata ?? null
    })
    .select()
    .single()

  if (msgError) throw msgError

  // 3. Save parts
  if (message.parts && message.parts.length > 0) {
    const partsToInsert = mapUIMessagePartsToDBParts(
      message.parts as any[],
      msgData.id
    )
    if (partsToInsert.length > 0) {
      const rows = partsToInsert.map((p: DBMessagePart) =>
        mapPartInsertToRow({ ...p, messageId: p.messageId } as any)
      )
      const { error: partsError } = await supabase.from('parts').insert(rows)
      if (partsError) throw partsError
    }
  }

  perfTime('DB - createChatWithFirstMessageTransaction completed', dbStart)

  return {
    chat: mapChatRow(chatData),
    message: mapMessageRow(msgData)
  }
}
