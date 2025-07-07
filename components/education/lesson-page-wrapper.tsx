'use client'

import { LessonPlayer } from '@/components/education/lesson-player'
import { type Lesson } from '@/lib/education/schema'

interface LessonPageWrapperProps {
  lesson: Lesson
}

export function LessonPageWrapper({ lesson }: LessonPageWrapperProps) {
  const handleLessonComplete = (lessonId: string) => {
    console.log('Lesson completed:', lessonId)
    // Here you would typically save progress to database
    // For now, we'll just show a success message
    alert(`Congratulations! You completed the lesson: ${lesson.title}`)
  }

  const handleStepComplete = (stepId: string, isCorrect: boolean) => {
    console.log('Step completed:', stepId, isCorrect)
    // Here you would typically save step progress to database
  }

  return (
    <LessonPlayer 
      lesson={lesson}
      onLessonComplete={handleLessonComplete}
      onStepComplete={handleStepComplete}
    />
  )
}
