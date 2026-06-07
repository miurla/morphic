/**
 * Analytics module types
 */

/** Length bucket of the user query. Avoids sending the raw text. */
export type QueryLenBucket = '0-20' | '21-50' | '51-120' | '120+'

/** Coarse language of the user query. */
export type QueryLang = 'en' | 'other'

/**
 * Privacy-preserving "shape" of a user query. The raw query stays in the DB;
 * only these derived signals are sent to analytics.
 */
export interface QueryShape {
  queryLenBucket: QueryLenBucket
  hasUrl: boolean
  lang: QueryLang
}

/**
 * Chat event data structure
 * Contains all information needed to track a chat interaction
 */
export interface ChatEventData {
  /** Search mode used for the chat */
  searchMode: 'quick' | 'planning' | 'adaptive'
  /** Conversation turn number (1-indexed, represents follow-up count) */
  conversationTurn: number
  /** Whether this is a new chat session */
  isNewChat: boolean
  /** Type of trigger that initiated the chat */
  trigger: 'submit-message' | 'regenerate-message'
  /** Chat session ID (CUID2 - safe for tracking) */
  chatId: string
  /** PostHog distinct id to attribute the event to (user id or guest id) */
  distinctId: string
  /** Whether the sender is a guest (unauthenticated) */
  isGuest: boolean
  /** User ID (Supabase UUID) - present only for authenticated users */
  userId?: string
  /** Provider identifier used for the chat */
  providerId: string
  /** Model identifier used for the chat */
  modelId: string
  /** Derived query shape (omitted for regenerate, where no new query exists) */
  queryShape?: QueryShape
}
