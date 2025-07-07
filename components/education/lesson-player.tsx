'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { type Lesson } from '@/lib/education/schema'
import { executeCode, type ExecutionResult } from '@/lib/services/code-execution'
import {
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Code,
    Eye,
    Lightbulb,
    Play,
    RotateCcw,
    Terminal,
    Trophy,
    XCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface LessonPlayerProps {
  lesson: Lesson
  onLessonComplete?: (lessonId: string) => void
  onStepComplete?: (stepId: string, isCorrect: boolean) => void
}

export function LessonPlayer({ lesson, onLessonComplete, onStepComplete }: LessonPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [userCode, setUserCode] = useState('')
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentHint, setCurrentHint] = useState(0)
  const [mode, setMode] = useState<'instruction' | 'code' | 'preview'>('instruction')

  const currentStep = lesson.steps[currentStepIndex]
  const progress = Math.round((completedSteps.size / lesson.steps.length) * 100)
  const isLastStep = currentStepIndex === lesson.steps.length - 1
  const isFirstStep = currentStepIndex === 0

  // Initialize code when step changes
  useEffect(() => {
    if (currentStep?.code?.startingCode) {
      setUserCode(currentStep.code.startingCode)
    }
    setExecutionResult(null)
    setCurrentHint(0)
    
    // Set default mode based on step type
    if (currentStep?.type === 'instruction') {
      setMode('instruction')
    } else if (currentStep?.type === 'code_exercise' || currentStep?.type === 'project') {
      setMode('code')
    }
  }, [currentStep])

  const handleRunCode = async () => {
    if (!userCode.trim()) return

    setIsExecuting(true)
    try {
      const result = await executeCode(
        lesson.language as 'javascript' | 'html' | 'css' | 'python',
        userCode
      )
      setExecutionResult(result)
    } catch (error) {
      setExecutionResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [],
        executionTime: 0
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleNextStep = () => {
    if (currentStepIndex < lesson.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }

  const handleStepComplete = () => {
    const stepId = currentStep.id
    const newCompletedSteps = new Set(completedSteps)
    newCompletedSteps.add(stepId)
    setCompletedSteps(newCompletedSteps)
    
    onStepComplete?.(stepId, true)
    
    // Check if lesson is complete
    if (newCompletedSteps.size === lesson.steps.length) {
      onLessonComplete?.(lesson.id)
    }
    
    // Auto-advance to next step if not last
    if (!isLastStep) {
      setTimeout(() => handleNextStep(), 1000)
    }
  }

  const handleReset = () => {
    if (currentStep?.code?.startingCode) {
      setUserCode(currentStep.code.startingCode)
    }
    setExecutionResult(null)
  }

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'instruction': return <Eye className="h-4 w-4" />
      case 'code_exercise': return <Code className="h-4 w-4" />
      case 'project': return <Trophy className="h-4 w-4" />
      default: return <Terminal className="h-4 w-4" />
    }
  }

  const getStepTypeColor = (type: string) => {
    switch (type) {
      case 'instruction': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'code_exercise': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'project': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const isStepCompleted = (stepId: string) => completedSteps.has(stepId)

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-8">
      {/* Lesson Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{lesson.title}</CardTitle>
              <CardDescription className="text-base mt-1">{lesson.description}</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{lesson.language.toUpperCase()}</Badge>
              <Badge variant="outline">{lesson.difficulty}</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{lesson.estimatedDuration} min</span>
              </div>
              <div className="flex items-center space-x-1">
                <Trophy className="h-4 w-4" />
                <span>Step {currentStepIndex + 1} of {lesson.steps.length}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {progress}% Complete
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
      </Card>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Instructions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStepTypeIcon(currentStep.type)}
                <CardTitle className="text-lg">{currentStep.title}</CardTitle>
              </div>
              <Badge className={`${getStepTypeColor(currentStep.type)}`}>
                {currentStep.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step Content */}
            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ 
                __html: currentStep.content.replace(/\n/g, '<br/>') 
              }} />
            </div>

            {/* Hints */}
            {currentStep.interactive?.hints && currentStep.interactive.hints.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm flex items-center">
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Hint {currentHint + 1} of {currentStep.interactive.hints.length}
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
                      onClick={() => setCurrentHint(Math.min(currentStep.interactive!.hints!.length - 1, currentHint + 1))}
                      disabled={currentHint === currentStep.interactive.hints.length - 1}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {currentStep.interactive.hints[currentHint]}
                </p>
              </div>
            )}

            {/* Step Actions */}
            <div className="flex items-center space-x-2">
              {isStepCompleted(currentStep.id) && (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
              {currentStep.type !== 'instruction' && (
                <Button
                  onClick={handleStepComplete}
                  disabled={isStepCompleted(currentStep.id)}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Code Editor/Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {currentStep.type === 'instruction' ? 'Example' : 'Your Code'}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!currentStep.code?.startingCode}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleRunCode}
                  disabled={isExecuting || !userCode.trim()}
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-1" />
                  {isExecuting ? 'Running...' : 'Run Code'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Code Editor */}
            <Textarea
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              placeholder="Write your code here..."
              className="min-h-[300px] font-mono text-sm"
              disabled={currentStep.type === 'instruction'}
            />

            {/* Execution Result */}
            {executionResult && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {executionResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {executionResult.success ? 'Success' : 'Error'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({executionResult.executionTime}ms)
                  </span>
                </div>
                
                {executionResult.output && (
                  <div className="text-sm">
                    <strong>Output:</strong>
                    <pre className="mt-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
                      {executionResult.output}
                    </pre>
                  </div>
                )}
                
                {executionResult.error && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong>
                    <pre className="mt-1 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border overflow-x-auto">
                      {executionResult.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={isFirstStep}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              {lesson.steps.map((step, index) => (
                <Button
                  key={step.id}
                  variant={index === currentStepIndex ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentStepIndex(index)}
                  className={`w-8 h-8 p-0 ${isStepCompleted(step.id) ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}`}
                >
                  {isStepCompleted(step.id) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </Button>
              ))}
            </div>
            
            <Button
              onClick={handleNextStep}
              disabled={isLastStep}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
