import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createLessonDesignStream } from '@/lib/agents/lesson-designer'
import { Lesson } from '@/lib/education/schema'
import { Model } from '@/lib/types/models'
import { NextRequest } from 'next/server'

export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai',
  enabled: true,
  toolCallType: 'native'
}

export async function POST(req: NextRequest) {
  try {
    const { messages, lessonDraft } = await req.json()
    const userId = await getCurrentUserId()

    // Check if user is admin (you may want to implement proper admin check)
    if (!userId) {
      return new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized'
      })
    }

    const stream = await createLessonDesignStream({
      messages,
      model: DEFAULT_MODEL,
      lessonDraft,
      onLessonUpdate: (lesson: Partial<Lesson>) => {
        // In a real implementation, you might want to update the lesson draft in the database
        console.log('Lesson updated:', lesson)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform'
      }
    })
  } catch (error) {
    console.error('Lesson design API error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
