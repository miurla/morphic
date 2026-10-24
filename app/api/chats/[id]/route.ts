import { NextRequest, NextResponse } from 'next/server'

import { loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const userId = await getCurrentUserId()
  try {
    const { id } = await params
    const chat = await loadChat(id, userId ?? undefined)
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404, headers }
      )
    }
    return NextResponse.json(
      {
        id: chat.id,
        title: chat.title,
        visibility: chat.visibility,
        userId: chat.userId,
        messages: chat.messages
      },
      { headers }
    )
  } catch (error) {
    console.error('API route error fetching chat:', error)
    return NextResponse.json(
      { error: 'Failed to load chat' },
      { status: 500, headers }
    )
  }
}
