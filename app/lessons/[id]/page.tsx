import { LessonPageWrapper } from '@/components/education/lesson-page-wrapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getLessonById } from '@/lib/education/lesson-database'
import { ArrowLeft, Clock, Code, Trophy, User } from 'lucide-react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface LessonPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { id } = await params
  const lesson = await getLessonById(id)
  
  if (!lesson) {
    return {
      title: 'Lesson Not Found',
      description: 'The requested lesson could not be found.'
    }
  }

  return {
    title: `${lesson.title} - Interactive Programming Lesson`,
    description: lesson.description,
  }
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params
  const lesson = await getLessonById(id)

  if (!lesson) {
    notFound()
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'frontend': return <Code className="h-4 w-4" />
      case 'backend': return <Trophy className="h-4 w-4" />
      case 'fullstack': return <Trophy className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 min-h-full">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/lessons">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lessons
          </Button>
        </Link>
      </div>

      {/* Lesson Header */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              {getCategoryIcon(lesson.category)}
              <span className="text-sm font-medium text-muted-foreground">
                {lesson.language.toUpperCase()}
              </span>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(lesson.difficulty)}`}>
              {lesson.difficulty}
            </div>
          </div>
          <CardTitle className="text-2xl">{lesson.title}</CardTitle>
          <CardDescription className="text-base">{lesson.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{lesson.estimatedDuration} minutes</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span>{lesson.steps.length} steps</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>By {lesson.author}</span>
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">What you&apos;ll learn:</h4>
              <ul className="text-sm space-y-1">
                {lesson.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Prerequisites */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Prerequisites:</h4>
              {lesson.prerequisites && lesson.prerequisites.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {lesson.prerequisites.map((prerequisite, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{prerequisite}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None - perfect for beginners!</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Lesson */}
      <LessonPageWrapper lesson={lesson} />

      {/* Additional Resources */}
      {lesson.resources && lesson.resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Resources</CardTitle>
            <CardDescription>
              Helpful links and materials to supplement your learning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lesson.resources.map((resource, index) => (
                <a
                  key={index}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Code className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{resource.title}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{resource.type}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
