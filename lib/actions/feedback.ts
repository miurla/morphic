'use server'

import {
  getMessageFeedback as getMessageFeedbackQuery,
  updateMessageFeedback as updateMessageFeedbackQuery
} from '@/lib/supabase/queries/feedback'

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  userId: string | null = null
) {
  return updateMessageFeedbackQuery(messageId, score, userId)
}

export async function getMessageFeedback(
  messageId: string,
  userId: string | null = null
) {
  return getMessageFeedbackQuery(messageId, userId)
}
