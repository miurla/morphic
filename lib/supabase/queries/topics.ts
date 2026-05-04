import type { SupabaseClient } from '@supabase/supabase-js'
import { mapTopicRow, type Topic } from '../types'

type DB = SupabaseClient

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function getRootTopics(db: DB): Promise<Topic[]> {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapTopicRow)
}

export async function getTopicChildren(
  db: DB,
  parentId: string
): Promise<Topic[]> {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapTopicRow)
}

export async function getTopicBySlug(
  db: DB,
  slug: string
): Promise<Topic | null> {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return mapTopicRow(data)
}

export async function getAllTopics(db: DB): Promise<Topic[]> {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapTopicRow)
}

// ---------------------------------------------------------------
// Chat ↔ Topic tagging
// ---------------------------------------------------------------

export async function tagChatWithTopics(
  db: DB,
  chatId: string,
  topicIds: { topicId: string; confidence?: number }[]
): Promise<void> {
  const rows = topicIds.map(({ topicId, confidence }) => ({
    chat_id: chatId,
    topic_id: topicId,
    confidence: confidence ?? null
  }))

  const { error } = await db
    .from('chat_topics')
    .upsert(rows, { onConflict: 'chat_id,topic_id' })

  if (error) throw error
}

export async function getChatTopicIds(
  db: DB,
  chatId: string
): Promise<string[]> {
  const { data, error } = await db
    .from('chat_topics')
    .select('topic_id')
    .eq('chat_id', chatId)

  if (error) throw error
  return (data ?? []).map((r: any) => r.topic_id as string)
}
