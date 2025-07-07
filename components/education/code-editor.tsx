'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    AlertCircle,
    CheckCircle,
    Copy,
    Play,
    RotateCcw,
    Settings,
    Square,
    XCircle
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

// Monaco Editor types (would be imported from @monaco-editor/react in real implementation)
interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  theme: 'vs-dark' | 'vs-light'
  options?: any
  highlightedLines?: number[]
  readOnlyLines?: number[]
  onMount?: (editor: any) => void
}

// Mock Monaco Editor Component (in real implementation, use @monaco-editor/react)
const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
  value, 
  onChange, 
  language, 
  theme, 
  options = {},
  highlightedLines = [],
  readOnlyLines = [],
  onMount
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
  }

  return (
    <div className="relative w-full h-full">
      <textarea
        ref={editorRef}
        value={localValue}
        onChange={handleChange}
        className={`w-full h-full p-4 font-mono text-sm resize-none border-0 focus:outline-none ${
          theme === 'vs-dark' 
            ? 'bg-gray-900 text-gray-100' 
            : 'bg-white text-gray-900'
        }`}
        style={{
          minHeight: '300px',
          fontSize: options.fontSize || 14,
          tabSize: options.tabSize || 2,
          lineHeight: 1.5
        }}
        placeholder={`// Write your ${language} code here...`}
        spellCheck={false}
      />
      
      {/* Highlighted lines overlay (simplified) */}
      {highlightedLines.length > 0 && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {highlightedLines.map(line => (
            <div
              key={line}
              className="absolute w-full bg-yellow-200 bg-opacity-20 border-l-4 border-yellow-400"
              style={{
                top: `${(line - 1) * 21}px`, // Approximate line height
                height: '21px'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CodeExecutionResult {
  success: boolean
  output?: string
  error?: string
  logs?: string[]
}

interface CodeEditorProps {
  language: string
  value?: string
  initialCode?: string
  solution?: string
  tests?: Array<{
    name: string
    code: string
    expected: any
  }>
  onChange?: (code: string) => void
  onCodeChange?: (code: string) => void
  onExecute?: (code: string) => Promise<CodeExecutionResult>
  theme?: 'vs-dark' | 'vs-light'
  readOnly?: boolean
  highlightedLines?: number[]
  className?: string
  height?: string
}

export function CodeEditor({
  language,
  value,
  initialCode,
  solution,
  tests = [],
  onChange,
  onCodeChange,
  onExecute,
  theme = 'vs-dark',
  readOnly = false,
  highlightedLines = [],
  className = '',
  height = '400px'
}: CodeEditorProps) {
  const [code, setCode] = useState(value || initialCode || '')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<CodeExecutionResult | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [testResults, setTestResults] = useState<Array<{name: string, passed: boolean, error?: string}>>([])

  // Update code when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setCode(value)
    }
  }, [value])

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
    onChange?.(newCode)
    onCodeChange?.(newCode)
    // Clear previous execution results when code changes
    setExecutionResult(null)
    setTestResults([])
  }

  const handleExecute = async () => {
    if (!onExecute) {
      // Mock execution for demonstration
      setIsExecuting(true)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setExecutionResult({
        success: true,
        output: '// Code executed successfully\\nHello, World!',
        logs: ['Code executed at ' + new Date().toLocaleTimeString()]
      })
      setIsExecuting(false)
      return
    }

    setIsExecuting(true)
    try {
      const result = await onExecute(code)
      setExecutionResult(result)
      
      // Run tests if available
      if (tests.length > 0) {
        const results = await runTests(code, tests)
        setTestResults(results)
      }
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const runTests = async (code: string, tests: Array<{name: string, code: string, expected: any}>) => {
    // Mock test execution
    return tests.map(test => ({
      name: test.name,
      passed: Math.random() > 0.3, // Random pass/fail for demo
      error: Math.random() > 0.7 ? 'Test failed: Expected true, got false' : undefined
    }))
  }

  const resetCode = () => {
    setCode(initialCode || '')
    setExecutionResult(null)
    setTestResults([])
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code)
  }

  const showSolutionCode = () => {
    if (solution) {
      setCode(solution)
      setShowSolution(true)
    }
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            Code Editor - {language.toUpperCase()}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetCode}
              disabled={isExecuting}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            {solution && (
              <Button
                variant="outline"
                size="sm"
                onClick={showSolutionCode}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Solution
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="tests">Tests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor" className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="h-96">
                <MonacoEditor
                  value={code}
                  onChange={handleCodeChange}
                  language={language}
                  theme={theme}
                  highlightedLines={highlightedLines}
                  options={{
                    fontSize: 14,
                    tabSize: 2,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    minimap: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: readOnly
                  }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExecute}
                disabled={isExecuting || readOnly}
                className="flex items-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <Square className="h-4 w-4" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Code
                  </>
                )}
              </Button>
              
              {showSolution && (
                <Badge variant="outline" className="text-green-600">
                  Solution Shown
                </Badge>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="output" className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold mb-2">Output</h3>
              {executionResult ? (
                <div className="space-y-2">
                  {executionResult.success ? (
                    <div className="text-green-600">
                      <CheckCircle className="h-4 w-4 inline mr-2" />
                      Execution successful
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <XCircle className="h-4 w-4 inline mr-2" />
                      Execution failed
                    </div>
                  )}
                  
                  {executionResult.output && (
                    <pre className="text-sm bg-white dark:bg-gray-800 p-2 rounded overflow-auto">
                      {executionResult.output}
                    </pre>
                  )}
                  
                  {executionResult.error && (
                    <pre className="text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-2 rounded overflow-auto">
                      {executionResult.error}
                    </pre>
                  )}
                  
                  {executionResult.logs && executionResult.logs.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <h4 className="font-medium">Logs:</h4>
                      {executionResult.logs.map((log, index) => (
                        <div key={index} className="font-mono">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  Run your code to see the output here
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="tests" className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Test Results</h3>
              {testResults.length > 0 ? (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900">
                      {result.passed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{result.name}</span>
                      {result.error && (
                        <span className="text-sm text-red-600 ml-auto">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : tests.length > 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Run your code to see test results
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  No tests configured for this exercise
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
