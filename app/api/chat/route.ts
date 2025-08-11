import { cookies } from 'next/headers'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { resetAllCounters } from '@/lib/utils/perf-tracking'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai'
}

export async function POST(req: Request) {
  const startTime = performance.now()
  const abortSignal = req.signal
  
  // Reset counters for new request
  resetAllCounters()

  try {
    const body = await req.json()
    const { message, chatId, trigger, messageId, isNewChat } = body
    
    console.log(`[PERF] API Route - Start: chatId=${chatId}, trigger=${trigger}, isNewChat=${isNewChat}`)

    // Handle different triggers
    if (trigger === 'regenerate-assistant-message') {
      if (!messageId) {
        return new Response('messageId is required for regeneration', {
          status: 400,
          statusText: 'Bad Request'
        })
      }
    } else if (trigger === 'submit-user-message') {
      if (!message) {
        return new Response('message is required for submission', {
          status: 400,
          statusText: 'Bad Request'
        })
      }
    }

    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')
    
    const authStart = performance.now()
    const userId = await getCurrentUserId()
    console.log(`[PERF] Auth completed: ${(performance.now() - authStart).toFixed(2)}ms`)

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    // Check if user is authenticated
    if (!userId) {
      return new Response('Authentication required', {
        status: 401,
        statusText: 'Unauthorized'
      })
    }

    const cookieStore = await cookies()
    const modelJson = cookieStore.get('selectedModel')?.value

    let selectedModel = DEFAULT_MODEL

    if (modelJson) {
      try {
        selectedModel = JSON.parse(modelJson) as Model
      } catch (e) {
        console.error('Failed to parse selected model:', e)
      }
    }

    if (!isProviderEnabled(selectedModel.providerId)) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    const streamStart = performance.now()
    const response = await createChatStreamResponse({
      message,
      model: selectedModel,
      chatId,
      userId: userId, // userId is guaranteed to be non-null after authentication check above
      trigger,
      messageId,
      abortSignal,
      isNewChat
    })
    
    const totalTime = performance.now() - startTime
    console.log(`[PERF] Total API route time: ${totalTime.toFixed(2)}ms`)
    
    // Print summary
    console.log(`[PERF] === Summary ===`)
    console.log(`[PERF] Chat Type: ${isNewChat ? 'NEW' : 'EXISTING'}`)
    console.log(`[PERF] Total Time: ${totalTime.toFixed(2)}ms`)
    console.log(`[PERF] ================`)
    
    return response
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
