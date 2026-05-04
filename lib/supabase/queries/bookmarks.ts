import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapCollectionRow,
  mapBookmarkRow,
  type Bookmark,
  type Collection
} from '../types'

type DB = SupabaseClient

// ---------------------------------------------------------------
// Collections
// ---------------------------------------------------------------

export async function getUserCollections(
  db: DB,
  userId: string
): Promise<Collection[]> {
  const { data, error } = await db
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapCollectionRow)
}

export async function createCollection(
  db: DB,
  userId: string,
  input: Pick<Collection, 'name' | 'description' | 'icon' | 'color' | 'isPublic'>
): Promise<Collection> {
  const { data, error } = await db
    .from('collections')
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      is_public: input.isPublic
    })
    .select()
    .single()

  if (error) throw error
  return mapCollectionRow(data)
}

export async function deleteCollection(
  db: DB,
  collectionId: string
): Promise<void> {
  const { error } = await db
    .from('collections')
    .delete()
    .eq('id', collectionId)

  if (error) throw error
}

// ---------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------

export async function getUserBookmarks(
  db: DB,
  userId: string,
  collectionId?: string
): Promise<Bookmark[]> {
  let query = db
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapBookmarkRow)
}

export async function addBookmark(
  db: DB,
  userId: string,
  input: Pick<
    Bookmark,
    | 'collectionId'
    | 'chatId'
    | 'url'
    | 'title'
    | 'description'
    | 'thumbnailUrl'
    | 'notes'
    | 'tags'
  >
): Promise<Bookmark> {
  const { data, error } = await db
    .from('bookmarks')
    .insert({
      user_id: userId,
      collection_id: input.collectionId ?? null,
      chat_id: input.chatId ?? null,
      url: input.url ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? []
    })
    .select()
    .single()

  if (error) throw error
  return mapBookmarkRow(data)
}

export async function removeBookmark(
  db: DB,
  bookmarkId: string
): Promise<void> {
  const { error } = await db
    .from('bookmarks')
    .delete()
    .eq('id', bookmarkId)

  if (error) throw error
}

export async function isBookmarked(
  db: DB,
  userId: string,
  chatId: string
): Promise<boolean> {
  const { data, error } = await db
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('chat_id', chatId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
