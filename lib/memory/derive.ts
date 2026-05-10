import Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq, gte } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  chats,
  messages,
  parts,
  userMemories,
  userMemoryEdits
} from '@/lib/db/schema'

import { MEMORY_EXTRACTION_PROMPT } from './extraction-prompt'

function extractJSON(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : '{}'
}

export async function deriveMemoryForUser(userId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[memory] No ANTHROPIC_API_KEY')
    return { operations: 0 }
  }

  // 1. Get recent conversations (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentChats = await db
    .select({ id: chats.id, title: chats.title })
    .from(chats)
    .where(
      and(
        eq(chats.userId, userId),
        gte(chats.createdAt, since.toISOString() as any)
      )
    )
    .orderBy(desc(chats.createdAt))
    .limit(10)

  if (recentChats.length === 0) {
    console.log('[memory] No recent conversations')
    return { operations: 0 }
  }

  // 2. Get text parts for those conversations
  const conversations = []
  for (const chat of recentChats) {
    const textParts = await db
      .select({
        role: messages.role,
        text: parts.text_text
      })
      .from(parts)
      .innerJoin(messages, eq(parts.messageId, messages.id))
      .where(
        and(
          eq(messages.chatId, chat.id),
          eq(parts.type, 'text')
        )
      )
      .orderBy(parts.order)
      .limit(20)

    const filtered = textParts.filter(p => p.text)
    if (filtered.length > 0) {
      conversations.push({
        title: chat.title,
        messages: filtered.map(p => ({
          role: p.role,
          content: (p.text ?? '').slice(0, 500)
        }))
      })
    }
  }

  if (conversations.length === 0) {
    return { operations: 0 }
  }

  // 3. Get current memory
  const currentMemory = await db
    .select()
    .from(userMemories)
    .where(eq(userMemories.userId, userId))

  // 4. Get user edits
  const edits = await db
    .select()
    .from(userMemoryEdits)
    .where(eq(userMemoryEdits.userId, userId))

  // 5. Call Claude to extract/update facts
  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: MEMORY_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          currentMemory: currentMemory.map(m => ({
            id: m.id,
            category: m.category,
            content: m.content,
            confidence: m.confidence
          })),
          userEdits: edits.map(e => ({
            instruction: e.instruction,
            type: e.type
          })),
          newConversations: conversations
        })
      }
    ]
  })

  // 6. Parse response
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { operations: 0 }
  }

  let diff: { operations: any[] }
  try {
    diff = JSON.parse(extractJSON(textBlock.text))
  } catch {
    console.error('[memory] Failed to parse extraction response')
    return { operations: 0 }
  }

  if (!diff.operations || diff.operations.length === 0) {
    return { operations: 0 }
  }

  // 7. Apply operations
  let applied = 0
  for (const op of diff.operations) {
    try {
      if (op.type === 'add' && op.category && op.content) {
        await db.insert(userMemories).values({
          userId,
          category: op.category,
          content: op.content.slice(0, 200),
          confidence: op.confidence ?? 80,
          expiresAt:
            op.category === 'goals'
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : undefined
        })
        applied++
      } else if (op.type === 'update' && op.id) {
        await db
          .update(userMemories)
          .set({
            content: op.content?.slice(0, 200),
            confidence: op.confidence,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(userMemories.id, op.id),
              eq(userMemories.userId, userId)
            )
          )
        applied++
      } else if (op.type === 'remove' && op.id) {
        await db
          .delete(userMemories)
          .where(
            and(
              eq(userMemories.id, op.id),
              eq(userMemories.userId, userId)
            )
          )
        applied++
      }
    } catch (err) {
      console.error('[memory] Failed to apply operation:', op, err)
    }
  }

  console.log(
    `[memory] Derived ${applied} operations for user ${userId} from ${conversations.length} conversations`
  )
  return { operations: applied }
}
