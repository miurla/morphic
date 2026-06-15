'use server'

import { and, desc, eq } from 'drizzle-orm'

import { generateId, readingItems } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'
import type {
  NormalizedReadingItemInput,
  ReadingItemStatus
} from '@/lib/sources/reading-items'

export async function saveReadingItem(
  userId: string,
  input: NormalizedReadingItemInput
) {
  try {
    return await withRLS(userId, async tx => {
      const [existing] = await tx
        .select()
        .from(readingItems)
        .where(
          and(
            eq(readingItems.userId, userId),
            eq(readingItems.canonicalUrl, input.canonicalUrl)
          )
        )
        .limit(1)

      const values = {
        userId,
        sourceId: input.sourceId,
        url: input.url,
        canonicalUrl: input.canonicalUrl,
        title: input.title,
        author: input.author,
        siteName: input.siteName,
        domain: input.domain,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        summary: input.summary,
        imageUrl: input.imageUrl,
        faviconUrl: input.faviconUrl,
        savedFromChatId: input.savedFromChatId,
        updatedAt: new Date()
      }

      if (existing) {
        const [item] = await tx
          .update(readingItems)
          .set(values)
          .where(eq(readingItems.id, existing.id))
          .returning()

        return { success: true as const, item, created: false }
      }

      const [item] = await tx
        .insert(readingItems)
        .values({
          id: generateId(),
          ...values,
          status: 'unread'
        })
        .returning()

      return { success: true as const, item, created: true }
    })
  } catch (error) {
    console.error('Failed to save reading item:', error)
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : 'Failed to save reading item'
    }
  }
}

export async function listReadingItems(
  userId: string,
  options: { status?: ReadingItemStatus } = {}
) {
  try {
    return await withRLS(userId, async tx => {
      const where = options.status
        ? and(
            eq(readingItems.userId, userId),
            eq(readingItems.status, options.status)
          )
        : eq(readingItems.userId, userId)

      const items = await tx
        .select()
        .from(readingItems)
        .where(where)
        .orderBy(desc(readingItems.createdAt))

      return { success: true as const, items }
    })
  } catch (error) {
    console.error('Failed to list reading items:', error)
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : 'Failed to list reading items'
    }
  }
}

export async function updateReadingItemStatus(
  userId: string,
  id: string,
  status: ReadingItemStatus
) {
  try {
    return await withRLS(userId, async tx => {
      const [item] = await tx
        .update(readingItems)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(and(eq(readingItems.userId, userId), eq(readingItems.id, id)))
        .returning()

      if (!item) {
        return { success: false as const, error: 'Reading item not found' }
      }

      return { success: true as const, item }
    })
  } catch (error) {
    console.error('Failed to update reading item status:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update reading item status'
    }
  }
}
