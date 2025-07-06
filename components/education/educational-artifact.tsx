'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Code,
  Terminal,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { CodeEditor } from './code-editor'
import { LivePreview } from './live-preview'
import { StepNavigation } from './step-navigation'

interface EducationalArtifactProps {
  lessonId?: string
  stepId?: string
  className?: string
}

interface MockLesson {
  id: string
  title: string
  description: string
  currentStep: number
  totalSteps: number
  progress: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  topics: string[]
  instructor: {
    name: string
    voice: string
  }
  currentStepData: {
    title: string
    description: string
    instructions: string[]
    code: string
    hints: string[]
    expectedOutput: string
    challenge: string
  }
}

// Mock data for demonstration
const mockLesson: MockLesson = {
  id: 'react-basics-1',
  title: 'React Components Fundamentals',
  description: 'Learn the basics of React components, props, and JSX syntax',
  currentStep: 2,
  totalSteps: 8,
  progress: 25,
  difficulty: 'beginner',
  estimatedTime: '15 minutes',
  topics: ['React', 'Components', 'JSX', 'Props'],
  instructor: {
    name: 'AI Instructor',
    voice: 'friendly-female'
  },
  currentStepData: {
    title: 'Creating Your First Component',
    description: 'In this step, you\'ll learn how to create a simple React component using JSX syntax.',
    instructions: [
      'Create a function component called `Welcome`',
      'Add a `name` prop to personalize the greeting',
      'Return JSX that displays a welcome message',
      'Test your component by calling it with different names'
    ],
    code: `import React from 'react'

// Create your Welcome component here
function Welcome({ name }) {
  return (
    <div className="welcome-container">
      <h1>Welcome to React, {name}!</h1>
      <p>This is your first component.</p>
    </div>
  )
}

// Export the component
export default Welcome`,
    hints: [
      'Remember to use curly braces {} for JavaScript expressions in JSX',
      'Props are passed as an object to your function component',
      'Don\'t forget to export your component at the end'
    ],
    expectedOutput: '<div class="welcome-container"><h1>Welcome to React, Alice!</h1><p>This is your first component.</p></div>',
    challenge: 'Modify the component to also display the current date and time'
  }
}

export function EducationalArtifact({
  lessonId = 'react-basics-1',
  stepId = 'step-2',
  className = ''
}: EducationalArtifactProps) {
  const [mode, setMode] = useState<'chat' | 'editor' | 'preview'>('chat')
  const [isNarrating, setIsNarrating] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentHint, setCurrentHint] = useState(0)
  const [code, setCode] = useState(mockLesson.currentStepData.code)
  const [executionResult, setExecutionResult] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)

  // Mock narration functionality
  const handleNarration = () => {
    setIsNarrating(!isNarrating)
    // In a real implementation, this would start/stop text-to-speech
    if (!isNarrating) {
      setTimeout(() => setIsNarrating(false), 3000) // Auto-stop after 3 seconds for demo
    }
  }

  // Mock code execution
  const handleCodeExecution = async () => {
    setIsExecuting(true)
    // Simulate code execution
    await new Promise(resolve => setTimeout(resolve, 1000))
    setExecutionResult('✓ Component rendered successfully!')
    setIsExecuting(false)
  }

  // Mock step navigation
  const handleStepNavigation = (stepId: number) => {
    console.log(`Navigating to step ${stepId}`)
    // In a real implementation, this would update the lesson state
  }

  // Mock reset functionality
  const handleReset = () => {
    setCode(mockLesson.currentStepData.code)
    setExecutionResult('')
    setCurrentHint(0)
  }

  // Mock fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={`educational-artifact ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Header with lesson info and controls */}
      <Card className="mb-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{mockLesson.title}</h2>
                <p className="text-sm text-muted-foreground">{mockLesson.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{mockLesson.difficulty}</Badge>
              <Badge variant="outline">{mockLesson.estimatedTime}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold">{mockLesson.currentStepData.title}</h3>
              <Badge variant="outline">Step {mockLesson.currentStep}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNarration}
              >
                {isNarrating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isNarrating ? 'Pause' : 'Narrate'}
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Step {mockLesson.currentStep} of {mockLesson.totalSteps}</span>
              <span>{mockLesson.progress}% Complete</span>
            </div>
            <Progress value={mockLesson.progress} className="w-full" />
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Area - Morphing Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
        {/* Chat/Instruction Panel */}
        <Card className={`${mode === 'editor' ? 'lg:col-span-4' : 'lg:col-span-6'} transition-all duration-300`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {mockLesson.currentStepData.description}
            </p>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Instructions:</h4>
              <ul className="space-y-2">
                {mockLesson.currentStepData.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hints Section */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <Lightbulb className="h-4 w-4 mr-1" />
                  Hint {currentHint + 1} of {mockLesson.currentStepData.hints.length}
                </h4>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentHint(Math.max(0, currentHint - 1))}
                    disabled={currentHint === 0}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentHint(Math.min(mockLesson.currentStepData.hints.length - 1, currentHint + 1))}
                    disabled={currentHint === mockLesson.currentStepData.hints.length - 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {mockLesson.currentStepData.hints[currentHint]}
              </p>
            </div>

            {/* Challenge Section */}
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <h4 className="font-semibold text-sm flex items-center mb-2">
                <AlertCircle className="h-4 w-4 mr-1" />
                Challenge
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {mockLesson.currentStepData.challenge}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Code Editor / Preview Panel */}
        <Card className={`${mode === 'chat' ? 'lg:col-span-6' : 'lg:col-span-8'} transition-all duration-300`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Interactive Workspace</CardTitle>
              <Tabs value={mode} onValueChange={(value) => setMode(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="chat" className="flex items-center space-x-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="editor" className="flex items-center space-x-1">
                    <Code className="h-4 w-4" />
                    <span>Code</span>
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center space-x-1">
                    <Eye className="h-4 w-4" />
                    <span>Preview</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} className="w-full">
              <TabsContent value="chat">
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">
                      👋 Hi! I'm your AI instructor. I'm here to help you learn React step by step. 
                      Ask me anything about the current lesson or if you need help with the code!
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">AI Instructor</p>
                        <p className="text-sm mt-1">
                          Great! You're working on creating your first React component. 
                          Remember that React components are just JavaScript functions that return JSX. 
                          The `name` prop will be passed to your function automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Chat input placeholder */}
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Ask me anything about this lesson..."
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button size="sm">Send</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="editor">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Code Editor</h4>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCodeExecution}
                        disabled={isExecuting}
                      >
                        <Terminal className="h-4 w-4 mr-1" />
                        {isExecuting ? 'Running...' : 'Run Code'}
                      </Button>
                    </div>
                  </div>
                  
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language="typescript"
                    height="400px"
                  />
                  
                  {executionResult && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {executionResult}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Live Preview</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode('editor')}
                    >
                      <Code className="h-4 w-4 mr-1" />
                      Edit Code
                    </Button>
                  </div>
                  
                  <LivePreview
                    code={code}
                    language="react"
                    height="400px"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Step Navigation */}
      <Card className="mt-4">
        <CardContent className="py-4">
          <StepNavigation
            currentStep={mockLesson.currentStep}
            totalSteps={mockLesson.totalSteps}
            onStepChange={handleStepNavigation}
            onNext={() => handleStepNavigation(mockLesson.currentStep + 1)}
            onPrevious={() => handleStepNavigation(mockLesson.currentStep - 1)}
          />
        </CardContent>
      </Card>
    </div>
  )
}