import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { publishLesson, saveLessonDraft } from '@/lib/education/lesson-storage'
import { generateLessonTTS } from '@/lib/services/tts-service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    
    if (!userId) {
      return new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized'
      })
    }

    const { lesson, generateTTS = true } = await req.json()
    
    // Add metadata
    const lessonWithMetadata = {
      ...lesson,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      createdAt: lesson.createdAt || new Date().toISOString(),
      status: 'draft'
    }

    // Save as draft first
    const lessonId = await saveLessonDraft(lessonWithMetadata)

    // Generate TTS if requested
    if (generateTTS) {
      try {
        await generateLessonTTS(lessonId, lessonWithMetadata)
        console.log(`TTS generated for lesson ${lessonId}`)
      } catch (ttsError) {
        console.error('TTS generation failed:', ttsError)
        // Continue with publishing even if TTS fails
      }
    }

    // Publish the lesson
    await publishLesson(lessonId)

    return Response.json({ 
      success: true, 
      lessonId,
      message: 'Lesson published successfully' + (generateTTS ? ' with TTS' : '')
    })
  } catch (error) {
    console.error('Error publishing lesson:', error)
    return Response.json(
      { success: false, error: 'Failed to publish lesson' },
      { status: 500 }
    )
  }
}
