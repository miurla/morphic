'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CodeEditor } from './code-editor'
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Code2, 
  Eye, 
  CheckCircle,
  Clock,
  Target,
  Volume2,
  VolumeX,
  Monitor,
  MessageCircle,
  Maximize2
} from 'lucide-react'

// Enhanced mock data for demonstration
const mockLesson = {
  id: 'js-variables-intro',
  title: 'Introduction to JavaScript Variables',
  difficulty: 'beginner',
  estimatedDuration: 15,
  currentStep: 2,
  totalSteps: 5,
  progress: 40,
  language: 'javascript'
}

const mockSteps = [
  {
    id: 'step-1',
    title: 'What Are Variables?',
    type: 'instruction',
    content: `# What Are Variables?

Variables are containers that store data values. In JavaScript, you can think of them as labeled boxes that hold information.

## Why Use Variables?
- Store data for later use
- Make code more readable
- Avoid repeating values
- Create dynamic programs

Let's start learning how to create and use variables!`,
    narration: 'Welcome to JavaScript variables! Variables are like labeled containers that store information.'
  },
  {
    id: 'step-2',
    title: 'Declaring Your First Variable',
    type: 'code_exercise',
    content: `# Declaring Your First Variable

Let's create your first variable! In JavaScript, we use the \`let\` keyword to declare a variable.

## Your Task
1. Declare a variable called \`message\`
2. Assign it the value "Hello, World!"
3. Use \`console.log()\` to display it`,
    code: {
      language: 'javascript',
      startingCode: '// Declare a variable called message and assign it "Hello, World!"\n// Then log it to the console\n\n',
      solution: 'let message = "Hello, World!";\nconsole.log(message);',
      tests: [
        {
          name: 'Variable Declaration',
          code: 'typeof message !== "undefined"',
          expected: true
        },
        {
          name: 'Correct Value',
          code: 'message === "Hello, World!"',
          expected: true
        }
      ]
    },
    narration: 'Now let\'s write some code! Declare a variable called message and assign it the value Hello, World.'
  },
  {
    id: 'step-3',
    title: 'Different Types of Variables',
    type: 'explanation',
    content: `# Different Types of Variables

JavaScript has several ways to declare variables:

## \`let\` - Block Scoped
- Can be reassigned
- Block scoped
- Modern way to declare variables

## \`const\` - Constant
- Cannot be reassigned
- Block scoped
- Use for values that won't change

## \`var\` - Function Scoped (Avoid)
- Can be reassigned
- Function scoped
- Older way, avoid in modern JavaScript`,
    code: {
      language: 'javascript',
      startingCode: '// Examples of different variable declarations\n\n// Constant - cannot be changed\nconst PI = 3.14159;\n\n// Let - can be reassigned\nlet age = 25;\nage = 26; // This is allowed\n\n// Var - avoid using this\nvar oldStyle = "Don\'t use this";',
      highlightedLines: [4, 7, 11]
    },
    narration: 'JavaScript has three ways to declare variables. Let me show you the differences.'
  }
]

/**
 * Enhanced Educational Artifact Component
 * 
 * Features:
 * - Dynamic interface morphing (chat/editor/preview modes)
 * - Integrated Monaco code editor
 * - Step-by-step lesson navigation
 * - AI narration controls
 * - Progress tracking
 * - Responsive design
 */
export function EducationalArtifact() {
  const [mode, setMode] = useState<'chat' | 'editor' | 'preview'>('chat')
  const [currentStepIndex, setCurrentStepIndex] = useState(1)
  const [isNarrating, setIsNarrating] = useState(false)
  const [code, setCode] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentStep = mockSteps[currentStepIndex]
  const canGoPrevious = currentStepIndex > 0
  const canGoNext = currentStepIndex < mockSteps.length - 1

  const handleModeChange = (newMode: 'chat' | 'editor' | 'preview') => {
    setMode(newMode)
    console.log(`Morphing interface to ${newMode} mode`)
  }

  const toggleNarration = () => {
    setIsNarrating(!isNarrating)
    console.log(`Narration ${!isNarrating ? 'started' : 'stopped'}: ${currentStep.narration}`)
  }

  const navigateStep = (direction: 'previous' | 'next') => {
    if (direction === 'previous' && canGoPrevious) {
      setCurrentStepIndex(currentStepIndex - 1)
    } else if (direction === 'next' && canGoNext) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
    
    // Reset code when changing steps
    const newStep = mockSteps[currentStepIndex + (direction === 'next' ? 1 : -1)]
    if (newStep?.code?.startingCode) {
      setCode(newStep.code.startingCode)
    }
  }

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
  }

  const handleCodeExecute = async (code: string) => {
    // Mock code execution
    console.log('Executing code:', code)
    return {
      success: true,
      output: 'Hello, World!',
      logs: ['Code executed successfully']
    }
  }

  return (
    <div className={`w-full mx-auto space-y-4 transition-all duration-300 ${
      isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'max-w-7xl p-4'
    }`}>
      {/* Lesson Header */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {mockLesson.title}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="secondary">{mockLesson.difficulty}</Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {mockLesson.estimatedDuration} min
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {mockSteps.length}
                </div>
              </div>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={mode === 'chat' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('chat')}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Chat
              </Button>
              <Button
                variant={mode === 'editor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('editor')}
              >
                <Code2 className="h-4 w-4 mr-1" />
                Editor
              </Button>
              <Button
                variant={mode === 'preview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('preview')}
              >
                <Monitor className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={mockLesson.progress} className="h-2" />
            </div>
            <div className="text-sm text-muted-foreground">
              {mockLesson.progress}% Complete
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{currentStep.title}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {currentStep.type.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleNarration}
                className="flex items-center gap-1"
              >
                {isNarrating ? (
                  <>
                    <VolumeX className="h-4 w-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    Listen
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateStep('previous')}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateStep('next')}
                disabled={!canGoNext}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dynamic Content Area */}
      <div className={`grid gap-4 transition-all duration-300 ${
        mode === 'chat' ? 'grid-cols-1' : 
        mode === 'editor' ? 'grid-cols-2' : 
        'grid-cols-1'
      }`}>
        {/* Lesson Content */}
        {(mode === 'chat' || mode === 'editor') && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Lesson Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div dangerouslySetInnerHTML={{ 
                  __html: currentStep.content.replace(/\n/g, '<br />') 
                }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Code Editor */}
        {currentStep.type === 'code_exercise' && (mode === 'editor' || mode === 'chat') && (
          <div className={mode === 'chat' ? 'mt-4' : ''}>
            <CodeEditor
              language={currentStep.code.language}
              initialCode={currentStep.code.startingCode}
              solution={currentStep.code.solution}
              tests={currentStep.code.tests}
              onCodeChange={handleCodeChange}
              onExecute={handleCodeExecute}
              highlightedLines={currentStep.code.highlightedLines}
              className="h-fit"
            />
          </div>
        )}

        {/* Code Display (for explanation steps) */}
        {currentStep.type === 'explanation' && currentStep.code && (
          <div className={mode === 'chat' ? 'mt-4' : ''}>
            <CodeEditor
              language={currentStep.code.language}
              initialCode={currentStep.code.startingCode}
              onCodeChange={handleCodeChange}
              highlightedLines={currentStep.code.highlightedLines}
              readOnly={true}
              className="h-fit"
            />
          </div>
        )}

        {/* Preview Mode */}
        {mode === 'preview' && (
          <Card className="h-96">
            <CardHeader>
              <CardTitle className="text-base">Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Monitor className="h-12 w-12 mx-auto mb-2" />
                  <p>Preview mode - Shows live output</p>
                  <p className="text-sm">Would display HTML/CSS/JS results here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Narration Status */}
      {isNarrating && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Volume2 className="h-4 w-4" />
              <span className="text-sm">AI Narration: "{currentStep.narration}"</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
            <div className="flex items-center gap-2">
              <Button
                variant={isNarrating ? "default" : "outline"}
                size="sm"
                onClick={toggleNarration}
                className="gap-2"
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
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <h1>{mockStep.title}</h1>
              <p>Let's create your first variable! In JavaScript, we use the <code>let</code> keyword to declare a variable.</p>
              
              <h2>Your Task</h2>
              <ol>
                <li>Declare a variable called <code>message</code></li>
                <li>Assign it the value "Hello, World!"</li>
                <li>Use <code>console.log()</code> to display it</li>
              </ol>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" size="sm" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Complete to continue</span>
              </div>
              <Button size="sm" className="gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Code Editor Panel */}
        <Card className={`${mode === 'chat' ? 'lg:col-span-6' : 'lg:col-span-8'} transition-all duration-300`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Code Editor
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={mode === 'chat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('chat')}
                >
                  Chat Focus
                </Button>
                <Button
                  variant={mode === 'editor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('editor')}
                >
                  Editor Focus
                </Button>
                <Button
                  variant={mode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('preview')}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="hints">Hints</TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor" className="mt-4">
                {/* Mock Code Editor */}
                <div className="border rounded-lg p-4 bg-slate-950 text-slate-50 font-mono text-sm min-h-[300px]">
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-8 text-slate-500 text-right pr-2">1</span>
                      <span className="text-slate-400">// Declare a variable called message and assign it "Hello, World!"</span>
                    </div>
                    <div className="flex">
                      <span className="w-8 text-slate-500 text-right pr-2">2</span>
                      <span className="text-slate-400">// Then log it to the console</span>
                    </div>
                    <div className="flex">
                      <span className="w-8 text-slate-500 text-right pr-2">3</span>
                      <span></span>
                    </div>
                    <div className="flex bg-slate-800 rounded">
                      <span className="w-8 text-slate-500 text-right pr-2">4</span>
                      <span className="text-green-400">let message = </span>
                      <span className="text-yellow-300">"Hello, World!"</span>
                      <span className="text-slate-50">;</span>
                      <span className="animate-pulse ml-1">|</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    JavaScript • Line 4, Column 28
                  </div>
                  <Button onClick={runCode} className="gap-2">
                    <Play className="h-4 w-4" />
                    Run Code
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="output" className="mt-4">
                <div className="border rounded-lg p-4 bg-slate-50 min-h-[300px]">
                  <div className="text-sm">
                    <div className="text-slate-600 mb-2">Console Output:</div>
                    <div className="font-mono text-green-600">Hello, World!</div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="hints" className="mt-4">
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-blue-800">💡 Hint 1</div>
                    <div className="text-sm text-blue-600 mt-1">
                      Use the <code>let</code> keyword to declare a variable
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-sm font-medium text-yellow-800">💡 Hint 2</div>
                    <div className="text-sm text-yellow-600 mt-1">
                      Assign a value using the equals sign (=)
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Debug Info */}
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            <strong>Current Mode:</strong> {mode} | 
            <strong> Narration:</strong> {isNarrating ? 'Active' : 'Inactive'} | 
            <strong> Highlighted Lines:</strong> {highlightedLines.join(', ') || 'None'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
