import { getAllLessons, getLessonById, getLessonsByCategory, getLessonsByDifficulty, searchLessons } from '@/lib/education/lesson-database'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')

    // Get single lesson by ID
    if (id) {
      const lesson = await getLessonById(id)
      if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }
      return NextResponse.json(lesson)
    }

    // Search lessons
    if (search) {
      const lessons = await searchLessons(search)
      return NextResponse.json(lessons)
    }

    // Filter by category
    if (category) {
      const lessons = await getLessonsByCategory(category)
      return NextResponse.json(lessons)
    }

    // Filter by difficulty
    if (difficulty) {
      const lessons = await getLessonsByDifficulty(difficulty as 'beginner' | 'intermediate' | 'advanced')
      return NextResponse.json(lessons)
    }

    // Get all lessons
    const lessons = await getAllLessons()
    return NextResponse.json(lessons)
  } catch (error) {
    console.error('Error in lessons API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
