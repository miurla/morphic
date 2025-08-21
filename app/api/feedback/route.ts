import { Langfuse } from 'langfuse'

import { updateMessageFeedback } from '@/lib/actions/feedback'
import { createClient } from '@/lib/supabase/server'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { traceId, score, comment, messageId } = body

    if (!traceId) {
      return new Response('traceId is required', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    if (score === undefined || (score !== 1 && score !== -1)) {
      return new Response('score must be 1 (good) or -1 (bad)', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    // Check if tracing is enabled
    if (!isTracingEnabled()) {
      return new Response('Feedback tracking is not enabled', {
        status: 200
      })
    }

    // Initialize Langfuse client
    const langfuse = new Langfuse()

    // Send score to Langfuse
    langfuse.score({
      traceId,
      name: 'user_feedback',
      value: score,
      comment
    })

    // Flush to ensure the score is sent
    await langfuse.flushAsync()

    // Get current user for RLS context
    let userId: string | null = null
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = await createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      userId = user?.id || null
    }

    // Update the message metadata with the feedback score using the action
    if (messageId) {
      const result = await updateMessageFeedback(messageId, score, userId)

      if (!result.success) {
        console.error('Error updating message feedback:', result.error)
        // Continue even if database update fails
      }
    }

    return new Response('Feedback recorded successfully', {
      status: 200
    })
  } catch (error) {
    console.error('Error recording feedback:', error)
    return new Response('Error recording feedback', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
