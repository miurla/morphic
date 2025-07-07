import { LessonBrowser } from '@/components/education/lesson-browser'
import { getAllLessons } from '@/lib/education/lesson-database'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Programming Lessons - Interactive Learning',
  description: 'Learn programming step by step with interactive lessons, real-time code execution, and AI-powered instruction.',
}

export default async function LessonsPage() {
  const lessons = await getAllLessons()

  return (
    <div className="container mx-auto py-8 px-4">
      <LessonBrowser lessons={lessons} />
    </div>
  )
}
