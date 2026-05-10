import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { userMemories, userMemoryEdits } from '@/lib/db/schema'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memories = await db
      .select()
      .from(userMemories)
      .where(eq(userMemories.userId, userId))
      .orderBy(userMemories.category, userMemories.updatedAt)

    const grouped: Record<string, typeof memories> = {}
    for (const m of memories) {
      if (!grouped[m.category]) grouped[m.category] = []
      grouped[m.category].push(m)
    }

    return NextResponse.json({ memories, grouped })
  } catch (error) {
    console.error('[memory] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'add') {
      const { category, content, confidence } = body
      const [memory] = await db
        .insert(userMemories)
        .values({
          userId,
          category,
          content,
          confidence: confidence ?? 80
        })
        .returning()
      return NextResponse.json(memory)
    }

    if (action === 'update') {
      const { id, content, confidence } = body
      await db
        .update(userMemories)
        .set({ content, confidence, updatedAt: new Date() })
        .where(
          and(eq(userMemories.id, id), eq(userMemories.userId, userId))
        )
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      await db
        .delete(userMemories)
        .where(
          and(eq(userMemories.id, id), eq(userMemories.userId, userId))
        )
      return NextResponse.json({ ok: true })
    }

    if (action === 'edit') {
      const { instruction, type } = body
      await db.insert(userMemoryEdits).values({
        userId,
        instruction,
        type: type ?? 'add'
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[memory] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process memory' },
      { status: 500 }
    )
  }
}
