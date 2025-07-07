import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { saveLessonDraft } from '@/lib/education/lesson-storage'
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

    const lesson = await req.json()
    
    // Add metadata
    const lessonWithMetadata = {
      ...lesson,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      createdAt: lesson.createdAt || new Date().toISOString(),
      status: 'draft'
    }

    const lessonId = await saveLessonDraft(lessonWithMetadata)

    return Response.json({ 
      success: true, 
      lessonId,
      message: 'Lesson draft saved successfully' 
    })
  } catch (error) {
    console.error('Error saving lesson draft:', error)
    return Response.json(
      { success: false, error: 'Failed to save lesson draft' },
      { status: 500 }
    )
  }
}
