'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { codeExecutionService } from '@/lib/services/code-execution'
import { ToolInvocation } from 'ai'
import { ChevronDown, ChevronUp, Code, Eye, MessageSquare, Play, SkipForward } from 'lucide-react'
import { useState, useEffect } from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { CodeEditor } from './education/code-editor'
import { LivePreview } from './education/live-preview'

interface EducationalLessonSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

export function EducationalLessonSection({
  tool,
  isOpen,
  onOpenChange,
  addToolResult
}: EducationalLessonSectionProps) {
  const [currentMode, setCurrentMode] = useState<'chat' | 'editor' | 'preview'>('chat')
  const [code, setCode] = useState('')
  const [executionResult, setExecutionResult] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  // Parse tool arguments and result
  const args = tool.args as any
  const result = tool.state === 'result' ? (tool as any).result : null

  // Extract lesson data from the tool result
  const lessonData = result?.lesson || {
    title: 'Interactive Lesson',
    description: 'Experience our morphing interface as you learn',
    steps: [
      {
        title: 'Welcome',
        content: 'Welcome to this interactive lesson!',
        type: 'instruction'
      }
    ]
  }

  const currentStepData = lessonData.steps?.[currentStep] || lessonData.steps?.[0]

  // Update progress based on current step
  useEffect(() => {
    if (lessonData.steps) {
      const newProgress = Math.round(((currentStep + 1) / lessonData.steps.length) * 100)
      setProgress(newProgress)
    }
  }, [currentStep, lessonData.steps])

  // Auto-switch to appropriate mode based on step type
  useEffect(() => {
    if (currentStepData?.type === 'code_exercise') {
      setCurrentMode('editor')
      setCode(currentStepData.code?.startingCode || '')
    } else if (currentStepData?.type === 'preview') {
      setCurrentMode('preview')
    } else {
      setCurrentMode('chat')
    }
  }, [currentStep, currentStepData])

  const handleExecuteCode = async () => {
    if (!code.trim()) return
    
    setIsExecuting(true)
    try {
      const result = await codeExecutionService.execute({
        language: currentStepData?.code?.language || 'javascript',
        code,
        timeout: 5000,
        memoryLimit: 128,
        allowNetwork: false,
        allowFileSystem: false
      })
      setExecutionResult(result.output || result.error || 'No output')
      
      // Auto-switch to preview mode after execution
      if (result.success) {
        setCurrentMode('preview')
      }
    } catch (error) {
      setExecutionResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep < lessonData.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCompleteLesson = () => {
    if (addToolResult) {
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          completed: true,
          progress: 100,
          finalStep: currentStep
        }
      })
    }
  }

  const displayTitle = `${lessonData.title} - Step ${currentStep + 1}`

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4" />
          <span>{displayTitle}</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Progress Header */}
        <div className="flex items-center justify-between text-sm">
          <Badge variant="secondary">Interactive Lesson</Badge>
          <span className="text-muted-foreground">
            Step {currentStep + 1} of {lessonData.steps?.length || 1}
          </span>
        </div>
        
        <Progress value={progress} className="w-full" />

        {/* Morphing Interface */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{currentStepData?.title}</CardTitle>
                <CardDescription className="text-sm">{lessonData.description}</CardDescription>
              </div>
              
              {/* Mode Selector - The morphing happens here */}
              <Tabs value={currentMode} onValueChange={(value) => setCurrentMode(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="chat" className="flex items-center space-x-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="editor" className="flex items-center space-x-1">
                    <Code className="h-4 w-4" />
                    <span className="hidden sm:inline">Code</span>
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center space-x-1">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Content that morphs based on mode */}
            <div className="min-h-[400px] transition-all duration-300 ease-in-out">
              {currentMode === 'chat' && (
                <div className="space-y-4 animate-in fade-in-50 duration-300">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: currentStepData?.content || '' }} />
                  </div>
                  
                  {currentStepData?.interactive?.hints && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">💡 Hints:</h4>
                      <ul className="space-y-1">
                        {currentStepData.interactive.hints.map((hint: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            • {hint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {currentMode === 'editor' && (
                <div className="space-y-4 animate-in fade-in-50 duration-300">
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={currentStepData?.code?.language || 'javascript'}
                    className="h-80"
                  />
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      onClick={handleExecuteCode}
                      disabled={isExecuting || !code.trim()}
                      className="flex items-center space-x-2"
                    >
                      <Play className="h-4 w-4" />
                      <span>{isExecuting ? 'Executing...' : 'Run Code'}</span>
                    </Button>
                    
                    {executionResult && (
                      <Button 
                        variant="outline" 
                        onClick={() => setCurrentMode('preview')}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Result</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {currentMode === 'preview' && (
                <div className="space-y-4 animate-in fade-in-50 duration-300">
                  <LivePreview
                    code={code}
                    language={currentStepData?.code?.language || 'javascript'}
                    className="h-80"
                  />
                  
                  {executionResult && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">🔍 Output:</h4>
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {executionResult}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              
              <span className="text-sm text-muted-foreground">
                {progress}% Complete
              </span>
              
              {currentStep < lessonData.steps.length - 1 ? (
                <Button
                  onClick={handleNextStep}
                  className="flex items-center space-x-2"
                >
                  <span>Next Step</span>
                  <SkipForward className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleCompleteLesson}
                  className="flex items-center space-x-2"
                >
                  <span>Complete Lesson</span>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </CollapsibleMessage>
  )
}
