import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'

import { loadChat } from '@/lib/actions/chat'
import { calculateConversationTurn, trackChatEvent } from '@/lib/analytics'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceQualityLimit } from '@/lib/rate-limit/quality-limit'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { SearchMode } from '@/lib/types/search'
import { selectModel } from '@/lib/utils/model-selection'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { resetAllCounters } from '@/lib/utils/perf-tracking'
import { isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 300

export async function POST(req: Request) {
  const startTime = performance.now()
  const abortSignal = req.signal

  // Reset counters for new request (development only)
  if (process.env.ENABLE_PERF_LOGGING === 'true') {
    resetAllCounters()
  }

  try {
    const body = await req.json()
    const { message, chatId, trigger, messageId, isNewChat } = body

    perfLog(
      `API Route - Start: chatId=${chatId}, trigger=${trigger}, isNewChat=${isNewChat}`
    )

    // Handle different triggers using AI SDK standard values
    if (trigger === 'regenerate-message') {
      if (!messageId) {
        return new Response('messageId is required for regeneration', {
          status: 400,
          statusText: 'Bad Request'
        })
      }
    } else if (trigger === 'submit-message') {
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
    perfTime('Auth completed', authStart)

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

    // Get search mode from cookie
    const searchModeCookie = cookieStore.get('searchMode')?.value
    const searchMode: SearchMode =
      searchModeCookie && ['quick', 'adaptive'].includes(searchModeCookie)
        ? (searchModeCookie as SearchMode)
        : 'quick'

    // Select the appropriate model based on model type preference and search mode
    const selectedModel = selectModel({
      cookieStore,
      searchMode
    })

    if (!isProviderEnabled(selectedModel.providerId)) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    // Check rate limit for quality mode
    const modelTypeCookie = cookieStore.get('modelType')?.value
    const modelType =
      modelTypeCookie === 'quality' || modelTypeCookie === 'speed'
        ? modelTypeCookie
        : undefined
    const rateLimitResponse = await checkAndEnforceQualityLimit(
      userId,
      modelType === 'quality'
    )
    if (rateLimitResponse) return rateLimitResponse

    const streamStart = performance.now()
    perfLog(
      `createChatStreamResponse - Start: model=${selectedModel.providerId}:${selectedModel.id}, searchMode=${searchMode}, modelType=${modelType}`
    )

    const response = await createChatStreamResponse({
      message,
      model: selectedModel,
      chatId,
      userId: userId, // userId is guaranteed to be non-null after authentication check above
      trigger,
      messageId,
      abortSignal,
      isNewChat,
      searchMode,
      modelType
    })

    perfTime('createChatStreamResponse resolved', streamStart)

    // Track analytics event (non-blocking)
    // Calculate conversation turn by loading chat history
    ;(async () => {
      try {
        let conversationTurn = 1 // Default for new chats

        // For existing chats, load history and calculate turn number
        if (!isNewChat) {
          const chat = await loadChat(chatId, userId)
          if (chat?.messages) {
            // Add 1 to account for the current message being sent
            conversationTurn = calculateConversationTurn(chat.messages) + 1
          }
        }

        await trackChatEvent({
          searchMode,
          modelType: modelTypeCookie === 'quality' ? 'quality' : 'speed',
          conversationTurn,
          isNewChat: isNewChat ?? false,
          trigger:
            (trigger as 'submit-message' | 'regenerate-message') ??
            'submit-message',
          chatId,
          userId,
          modelId: selectedModel.id
        })
      } catch (error) {
        // Log error but don't throw - analytics should never break the app
        console.error('Analytics tracking failed:', error)
      }
    })()

    // Invalidate the cache for this specific chat after creating the response
    // This ensures the next load will get fresh data
    if (chatId) {
      revalidateTag(`chat-${chatId}`, 'max')
    }

    const totalTime = performance.now() - startTime
    perfLog(`Total API route time: ${totalTime.toFixed(2)}ms`)
    perfLog(`=== Summary ===`)
    perfLog(`Chat Type: ${isNewChat ? 'NEW' : 'EXISTING'}`)
    perfLog(`Total Time: ${totalTime.toFixed(2)}ms`)
    perfLog(`================`)

    return response
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
