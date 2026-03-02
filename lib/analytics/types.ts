/**
 * Analytics module types
 *
 * This module provides type definitions for analytics tracking.
 * The interfaces are provider-agnostic to allow future extensibility.
 */

/**
 * Chat event data structure
 * Contains all information needed to track a chat interaction
 */
export interface ChatEventData {
  /** Search mode used for the chat */
  searchMode: 'quick' | 'planning' | 'adaptive'
  /** Model type preference */
  modelType: 'speed' | 'quality'
  /** Conversation turn number (1-indexed, represents follow-up count) */
  conversationTurn: number
  /** Whether this is a new chat session */
  isNewChat: boolean
  /** Type of trigger that initiated the chat */
  trigger: 'submit-message' | 'regenerate-message'
  /** Chat session ID (CUID2 - safe for tracking) */
  chatId: string
  /** User ID (Supabase UUID - pseudonymized identifier) */
  userId: string
  /** Model identifier used for the chat */
  modelId: string
}

/**
 * Analytics provider interface
 * Future extensibility point: implement this interface for other providers
 * (e.g., PostHog, DataBuddy, custom analytics)
 */
export interface AnalyticsProvider {
  /**
   * Track a chat event
   * @param data - Chat event data to track
   */
  trackChatEvent(data: ChatEventData): Promise<void>
}
