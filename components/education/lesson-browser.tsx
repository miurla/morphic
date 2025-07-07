'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Lesson } from '@/lib/education/schema'
import { Clock, Code, Search, Star, Trophy, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LessonBrowserProps {
  lessons: Lesson[]
  onLessonSelect?: (lesson: Lesson) => void
  showFilters?: boolean
}

export function LessonBrowser({ lessons, onLessonSelect, showFilters = true }: LessonBrowserProps) {
  const router = useRouter()
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>(lessons)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')

  // Filter lessons based on search and filters
  useEffect(() => {
    let filtered = lessons

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.description.toLowerCase().includes(query) ||
        lesson.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(lesson => lesson.category === selectedCategory)
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(lesson => lesson.difficulty === selectedDifficulty)
    }

    // Language filter
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(lesson => lesson.language === selectedLanguage)
    }

    setFilteredLessons(filtered)
  }, [lessons, searchQuery, selectedCategory, selectedDifficulty, selectedLanguage])

  const handleLessonClick = (lesson: Lesson) => {
    if (onLessonSelect) {
      onLessonSelect(lesson)
    } else {
      router.push(`/lessons/${lesson.id}`)
    }
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
      case 'backend': return <Star className="h-4 w-4" />
      case 'fullstack': return <Trophy className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  // Get unique values for filters
  const categories = Array.from(new Set(lessons.map(lesson => lesson.category)))
  const difficulties = Array.from(new Set(lessons.map(lesson => lesson.difficulty)))
  const languages = Array.from(new Set(lessons.map(lesson => lesson.language)))

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Programming Lessons</h1>
        <p className="text-muted-foreground">
          Learn programming step by step with interactive lessons
        </p>
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                {difficulties.map(difficulty => (
                  <SelectItem key={difficulty} value={difficulty}>
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map(language => (
                  <SelectItem key={language} value={language}>
                    {language.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''} found
      </div>

      {/* Lessons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLessons.map((lesson) => (
          <Card key={lesson.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(lesson.category)}
                  <Badge variant="secondary" className="text-xs">
                    {lesson.language.toUpperCase()}
                  </Badge>
                </div>
                <Badge className={`text-xs ${getDifficultyColor(lesson.difficulty)}`}>
                  {lesson.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-lg line-clamp-2">{lesson.title}</CardTitle>
              <CardDescription className="line-clamp-2">
                {lesson.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{lesson.estimatedDuration} min</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trophy className="h-4 w-4" />
                  <span>{lesson.steps.length} steps</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {lesson.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {lesson.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{lesson.tags.length - 3} more
                  </Badge>
                )}
              </div>

              {/* Prerequisites */}
              {lesson.prerequisites && lesson.prerequisites.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Prerequisites: {lesson.prerequisites.join(', ')}
                </div>
              )}

              {/* Start Button */}
              <Button 
                onClick={() => handleLessonClick(lesson)}
                className="w-full"
              >
                Start Lesson
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredLessons.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No lessons found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or browse all lessons
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
              setSelectedDifficulty('all')
              setSelectedLanguage('all')
            }}
            className="mt-4"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}
