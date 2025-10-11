/**
 * Analytics module
 *
 * Provides a unified interface for tracking analytics events.
 * Currently uses Vercel Analytics, but designed to be provider-agnostic
 * for future extensibility.
 *
 * @module analytics
 */

export { trackChatEvent } from './track-chat-event'
export type { AnalyticsProvider, ChatEventData } from './types'
export { calculateConversationTurn } from './utils'
