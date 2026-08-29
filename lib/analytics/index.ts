/**
 * Analytics module
 *
 * Unified interface for tracking product analytics events via PostHog.
 *
 * @module analytics
 */

export { trackAccountDeleted } from './track-account-event'
export {
  type AdaptiveLimitEventData,
  trackAdaptiveLimitEvent
} from './track-adaptive-limit-event'
export { trackChatEvent } from './track-chat-event'
export {
  type ChatLimitEventData,
  trackChatLimitEvent
} from './track-chat-limit-event'
export type {
  ChatEventData,
  QueryLang,
  QueryLenBucket,
  QueryShape
} from './types'
export {
  calculateConversationTurn,
  calculateConversationTurnFromIds,
  deriveQueryShape
} from './utils'
