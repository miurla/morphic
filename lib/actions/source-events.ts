'use server'

import { sourceEvents } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import type { NormalizedSourceEventInput } from '@/lib/sources/source-events'

export async function recordSourceEvent(
  input: NormalizedSourceEventInput & { userId: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    await withOptionalRLS(input.userId, async tx => {
      await tx.insert(sourceEvents).values({
        userId: input.userId,
        chatId: input.chatId,
        sourceId: input.sourceId,
        eventType: input.eventType,
        sourceUrl: input.sourceUrl,
        sourceDomain: input.sourceDomain,
        pageUrl: input.pageUrl,
        metadata: input.metadata
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to record source event:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to record source event'
    }
  }
}
