'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { useRef, useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface LessonDraft {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDuration: number
  learningObjectives?: string[]
  prerequisites?: string[]
  steps: Array<{
    id: string
    title: string
    type: string
    content: string
    codeExample?: string
    interactiveElements?: string[]
    estimatedTime?: number
    order: number
  }>
}

export default function LessonCreator() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI lesson design assistant. I'll help you create engaging educational content through an iterative, collaborative process.

What type of lesson would you like to create today? I can help with:

🎯 **Programming Fundamentals** - Variables, functions, loops, data structures
🌐 **Web Development** - HTML, CSS, JavaScript, React, Node.js
🐍 **Python Programming** - Basics to advanced, data science, automation
📱 **Mobile Development** - React Native, Flutter, app design principles
🤖 **AI & Machine Learning** - Concepts, tools, practical applications
⚡ **DevOps & Tools** - Git, CI/CD, Docker, deployment strategies

To get started, please tell me:
1. **Topic**: What subject or technology?
2. **Audience**: Who are your target learners?
3. **Goals**: What should students achieve after this lesson?

I'll guide you through creating a comprehensive, interactive lesson with hands-on exercises and clear learning objectives!`,
      timestamp: new Date()
    }
  ])
  
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>({
    id: '',
    title: '',
    description: '',
    difficulty: 'beginner',
    estimatedDuration: 0,
    steps: []
  })

  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'preview'>('overview')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsLoading(true)

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/admin/lesson-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          lessonDraft
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      let aiResponseContent = ''
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          aiResponseContent += chunk

          setMessages(prev => prev.map(msg => 
            msg.id === aiMessage.id 
              ? { ...msg, content: aiResponseContent }
              : msg
          ))
        }

        // Try to extract lesson data from the response
        const jsonMatch = aiResponseContent.match(/```json\n([\s\S]*?)\n```/)
        if (jsonMatch) {
          try {
            const lessonData = JSON.parse(jsonMatch[1])
            setLessonDraft(prev => ({
              ...prev,
              ...lessonData,
              id: prev.id || Date.now().toString()
            }))
          } catch (error) {
            console.error('Failed to parse lesson data:', error)
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        console.error('Error getting AI response:', error)
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!lessonDraft.title.trim()) {
      alert('Please enter a lesson title before saving.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/lessons/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lessonDraft)
      })

      const result = await response.json()
      
      if (result.success) {
        setLessonDraft(prev => ({ ...prev, id: result.lessonId }))
        alert('Lesson draft saved successfully!')
      } else {
        throw new Error(result.error || 'Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save lesson draft. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!lessonDraft.title.trim() || lessonDraft.steps.length === 0) {
      alert('Please complete the lesson (title and at least one step) before publishing.')
      return
    }

    const confirmPublish = confirm(
      'This will generate TTS audio and publish the lesson. This may take a few minutes and incur API costs. Continue?'
    )
    
    if (!confirmPublish) return

    setIsPublishing(true)
    try {
      const response = await fetch('/api/admin/lessons/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lesson: lessonDraft,
          generateTTS: true
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setLessonDraft(prev => ({ ...prev, id: result.lessonId }))
        alert('Lesson published successfully with TTS audio!')
      } else {
        throw new Error(result.error || 'Failed to publish lesson')
      }
    } catch (error) {
      console.error('Error publishing lesson:', error)
      alert('Failed to publish lesson. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-6">
      {/* Chat Interface - Left Panel */}
      <div className="w-1/2 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>AI Lesson Design Assistant</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            {/* Messages */}
            <div className="flex-1 pr-4 overflow-y-auto max-h-96">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.role === 'assistant' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'assistant'
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground ml-auto'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="bg-primary/10 p-2 rounded-full">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex space-x-2">
              <Input
                placeholder="Describe your lesson idea..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                className="flex-1"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!currentMessage.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lesson Preview - Right Panel */}
      <div className="w-1/2 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>Lesson Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lesson Title</label>
                  <Input
                    placeholder="Enter lesson title..."
                    value={lessonDraft.title}
                    onChange={(e) => setLessonDraft(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    className="w-full p-3 border rounded-md resize-none h-24"
                    placeholder="Describe what students will learn..."
                    value={lessonDraft.description}
                    onChange={(e) => setLessonDraft(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Difficulty</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={lessonDraft.difficulty}
                      onChange={(e) => setLessonDraft(prev => ({ 
                        ...prev, 
                        difficulty: e.target.value as any 
                      }))}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (minutes)</label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={lessonDraft.estimatedDuration || ''}
                      onChange={(e) => setLessonDraft(prev => ({ 
                        ...prev, 
                        estimatedDuration: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                </div>

                {/* Learning Objectives */}
                {lessonDraft.learningObjectives && lessonDraft.learningObjectives.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Learning Objectives</label>
                    <div className="space-y-1">
                      {lessonDraft.learningObjectives.map((objective, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm">{objective}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prerequisites */}
                {lessonDraft.prerequisites && lessonDraft.prerequisites.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prerequisites</label>
                    <div className="space-y-1">
                      {lessonDraft.prerequisites.map((prerequisite, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm">{prerequisite}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="steps" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Lesson Steps</h3>
                    <Button size="sm">Add Step</Button>
                  </div>
                  
                  {lessonDraft.steps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No steps created yet.</p>
                      <p className="text-sm">Chat with the AI assistant to design your lesson structure.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lessonDraft.steps.map((step, index) => (
                        <Card key={step.id}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Step {index + 1}: {step.title}</h4>
                                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                    <span className="capitalize">{step.type}</span>
                                    {step.estimatedTime && <span>{step.estimatedTime} min</span>}
                                  </div>
                                </div>
                                <Button variant="outline" size="sm">Edit</Button>
                              </div>
                              
                              {step.content && (
                                <div className="text-sm text-muted-foreground border-l-2 border-muted pl-3">
                                  {step.content.length > 150 
                                    ? `${step.content.substring(0, 150)}...` 
                                    : step.content
                                  }
                                </div>
                              )}
                              
                              {step.codeExample && (
                                <div className="bg-muted p-2 rounded text-sm font-mono">
                                  <div className="text-xs text-muted-foreground mb-1">Code Example:</div>
                                  <code>{step.codeExample.substring(0, 100)}...</code>
                                </div>
                              )}
                              
                              {step.interactiveElements && step.interactiveElements.length > 0 && (
                                <div className="flex gap-1">
                                  {step.interactiveElements.map((element, i) => (
                                    <span 
                                      key={i}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                    >
                                      {element}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Lesson preview will appear here</p>
                    <p className="text-sm">Complete the lesson design to see the interactive preview</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-4 flex space-x-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Draft'
            )}
          </Button>
          <Button 
            className="flex-1"
            onClick={handlePublish}
            disabled={isSaving || isPublishing}
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Publishing...
              </>
            ) : (
              'Generate TTS & Publish'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
