import type { SupabaseClient } from '@supabase/supabase-js'

import { mapSourceRow, type Source } from '../types'

type DB = SupabaseClient

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function getAllSources(db: DB): Promise<Source[]> {
  const { data, error } = await db
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .order('trust_score', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapSourceRow)
}

export async function getFeaturedSources(db: DB): Promise<Source[]> {
  const { data, error } = await db
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('trust_score', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapSourceRow)
}

export async function getSourcesByTopic(
  db: DB,
  topicId: string
): Promise<Source[]> {
  const { data, error } = await db
    .from('source_topics')
    .select('sources(*)')
    .eq('topic_id', topicId)

  if (error) throw error

  return (data ?? [])
    .map((row: any) => row.sources)
    .filter(Boolean)
    .filter((s: any) => s.is_active)
    .map(mapSourceRow)
    .sort((a: Source, b: Source) => b.trustScore - a.trustScore)
}

export async function getSourceByDomain(
  db: DB,
  domain: string
): Promise<Source | null> {
  const { data, error } = await db
    .from('sources')
    .select('*')
    .eq('domain', domain)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return mapSourceRow(data)
}
