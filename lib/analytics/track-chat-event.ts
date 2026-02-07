import { track } from '@vercel/analytics/server'

import type { ChatEventData } from './types'

/**
 * Track a chat event to analytics provider
 *
 * Currently uses Vercel Analytics. Only sends events when MORPHIC_CLOUD_DEPLOYMENT=true.
 * Errors are logged but do not interrupt the application flow.
 *
 * Future extensibility: This function can be modified to support multiple providers
 * by checking an environment variable (e.g., ANALYTICS_PROVIDER) and routing to
 * the appropriate provider implementation.
 *
 * @param data - Chat event data to track
 *
 * @example
 * ```typescript
 * await trackChatEvent({
 *   searchMode: 'quick',
 *   modelType: 'quality',
 *   conversationTurn: 1,
 *   isNewChat: true,
 *   trigger: 'submit-message',
 *   chatId: 'clx3k2j5m0000qzrmn4y8b9wy',
 *   userId: '550e8400-e29b-41d4-a716-446655440000',
 *   modelId: 'gpt-4'
 * })
 * ```
 */
export async function trackChatEvent(data: ChatEventData): Promise<void> {
  // Only track events in cloud deployment environment
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return
  }

  try {
    // Send event to Vercel Analytics
    await track('chat_message_sent', {
      searchMode: data.searchMode,
      modelType: data.modelType,
      conversationTurn: data.conversationTurn,
      isNewChat: data.isNewChat,
      trigger: data.trigger,
      chatId: data.chatId, // CUID2 - safe for tracking
      userId: data.userId, // Supabase UUID - pseudonymized identifier
      modelId: data.modelId
    })
  } catch (error) {
    // Log error but don't throw - analytics should never break the app
    console.error('Failed to track analytics event:', error)
  }
}
