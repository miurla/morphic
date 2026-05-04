'use server'

import { Langfuse } from 'langfuse'

import { createAdminClient } from '@/lib/supabase/admin'
import type { UIMessageMetadata } from '@/lib/types/ai'
import { generateId } from '@/lib/utils/id'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  _userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Get the current message
    const { data: current, error: fetchError } = await supabase
      .from('messages')
      .select('metadata, chat_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !current) {
      return { success: false, error: 'Message not found' }
    }

    const updatedMetadata = {
      ...(current.metadata || {}),
      feedbackScore: score
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({ metadata: updatedMetadata })
      .eq('id', messageId)

    if (updateError) throw updateError

    // Send feedback to Langfuse if trace ID exists and tracing is enabled
    const traceId = (current.metadata as UIMessageMetadata)?.traceId
    if (traceId && isTracingEnabled()) {
      const langfuse = new Langfuse()
      langfuse.score({
        traceId,
        name: 'user-feedback',
        value: score,
        comment: score === 1 ? 'Thumbs up' : 'Thumbs down'
      })
      await langfuse.flushAsync()
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update feedback'
    }
  }
}

export async function getMessageFeedback(
  messageId: string,
  _userId: string | null = null
): Promise<number | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', messageId)
      .single()

    if (error || !data) return null

    return (data.metadata as UIMessageMetadata)?.feedbackScore ?? null
  } catch (error) {
    console.error('Error getting message feedback:', error)
    return null
  }
}

export async function submitSiteFeedback(data: {
  id: string
  userId?: string
  sentiment: 'positive' | 'neutral' | 'negative'
  message: string
  pageUrl: string
  userAgent?: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('feedback').insert({
    id: data.id,
    user_id: data.userId ?? null,
    sentiment: data.sentiment,
    message: data.message,
    page_url: data.pageUrl,
    user_agent: data.userAgent ?? null
  })
  if (error) throw error
}
