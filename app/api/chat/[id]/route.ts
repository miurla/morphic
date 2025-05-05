import { deleteChat } from '@/lib/actions/chat'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return NextResponse.json(
      { error: 'Chat history saving is disabled.' },
      { status: 403 }
    )
  }

  const chatId = params.id
  if (!chatId) {
    return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
  }

  // Replace 'anonymous' with your actual user ID logic if needed
  const userId = 'anonymous'

  try {
    const result = await deleteChat(chatId, userId)

    if (result.error) {
      const statusCode = result.error === 'Chat not found' ? 404 : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`API route error deleting chat ${chatId}:`, error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
