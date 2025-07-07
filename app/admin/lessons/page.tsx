'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Edit, Eye, Plus, Search, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Lesson {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDuration: number
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
  steps?: Array<{ id: string; title: string; type: string }>
}

export default function LessonManagement() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'drafts' | 'published'>('drafts')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLessons()
  }, [activeTab])

  const loadLessons = async () => {
    setIsLoading(true)
    try {
      // In a real implementation, you would fetch from your API
      // For now, let's show some mock data
      const mockLessons: Lesson[] = [
        {
          id: '1',
          title: 'JavaScript Fundamentals',
          description: 'Learn the basics of JavaScript programming including variables, functions, and control structures.',
          difficulty: 'beginner',
          estimatedDuration: 45,
          status: activeTab === 'drafts' ? 'draft' : 'published',
          createdAt: new Date('2024-01-15').toISOString(),
          updatedAt: new Date('2024-01-16').toISOString(),
          steps: [
            { id: '1', title: 'Introduction to Variables', type: 'explanation' },
            { id: '2', title: 'Working with Functions', type: 'exercise' },
            { id: '3', title: 'Control Structures', type: 'exercise' }
          ]
        },
        {
          id: '2',
          title: 'React Components',
          description: 'Build reusable UI components with React including props, state, and event handling.',
          difficulty: 'intermediate',
          estimatedDuration: 60,
          status: activeTab === 'drafts' ? 'draft' : 'published',
          createdAt: new Date('2024-01-10').toISOString(),
          updatedAt: new Date('2024-01-12').toISOString(),
          steps: [
            { id: '1', title: 'Component Basics', type: 'explanation' },
            { id: '2', title: 'Props and State', type: 'exercise' },
            { id: '3', title: 'Event Handling', type: 'exercise' },
            { id: '4', title: 'Component Lifecycle', type: 'explanation' }
          ]
        }
      ]
      
      setTimeout(() => {
        setLessons(mockLessons)
        setIsLoading(false)
      }, 500)
    } catch (error) {
      console.error('Error loading lessons:', error)
      setIsLoading(false)
    }
  }

  const filteredLessons = lessons.filter(lesson =>
    lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lesson.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    if (confirm('Are you sure you want to delete this lesson? This action cannot be undone.')) {
      // In a real implementation, you would call your delete API
      setLessons(prev => prev.filter(lesson => lesson.id !== lessonId))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lesson Management</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage your educational content
          </p>
        </div>
        <Link href="/admin/lessons/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create New Lesson
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search lessons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {filteredLessons.length} draft lesson(s)
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLessons.map(lesson => (
                <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge className={getDifficultyColor(lesson.difficulty)}>
                            {lesson.difficulty}
                          </Badge>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {lesson.estimatedDuration} min
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {lesson.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {lesson.description}
                    </p>
                    
                    {lesson.steps && (
                      <div className="text-xs text-muted-foreground mb-4">
                        {lesson.steps.length} steps • Last updated {new Date(lesson.updatedAt).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {!isLoading && filteredLessons.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground">
                  <p>No draft lessons found.</p>
                  <p className="text-sm">Create your first lesson to get started!</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="published" className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {filteredLessons.length} published lesson(s)
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLessons.map(lesson => (
                <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge className={getDifficultyColor(lesson.difficulty)}>
                            {lesson.difficulty}
                          </Badge>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {lesson.estimatedDuration} min
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="h-3 w-3 mr-1" />
                            0 students
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {lesson.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {lesson.description}
                    </p>
                    
                    {lesson.steps && (
                      <div className="text-xs text-muted-foreground mb-4">
                        {lesson.steps.length} steps • Published {new Date(lesson.updatedAt).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-3 w-3 mr-1" />
                        View Live
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {!isLoading && filteredLessons.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground">
                  <p>No published lessons found.</p>
                  <p className="text-sm">Publish your first lesson to make it available to students!</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
