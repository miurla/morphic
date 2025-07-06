'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  Square, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { executeCode, type ExecutionResult } from '@/lib/services/code-execution'

export interface LivePreviewProps {
  code: string
  language: 'javascript' | 'python' | 'html' | 'css' | 'typescript' | 'react'
  autoExecute?: boolean
  showConsole?: boolean
  className?: string
  height?: string
  onExecutionChange?: (result: ExecutionResult) => void
}

export function LivePreview({
  code,
  language,
  autoExecute = true,
  showConsole = true,
  className,
  onExecutionChange
}: LivePreviewProps) {
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isPreviewVisible, setIsPreviewVisible] = useState(true)
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (autoExecute && code.trim()) {
      // Debounce execution
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        executeUserCode()
      }, 500)
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [code, autoExecute])

  const executeUserCode = async () => {
    if (!code.trim()) return
    
    setIsExecuting(true)
    
    try {
      // Map react to javascript for execution
      const executionLanguage = language === 'react' ? 'javascript' : language
      const executionResult = await executeCode(executionLanguage as 'javascript' | 'python' | 'html' | 'css' | 'typescript', code)
      setResult(executionResult)
      setExecutionHistory(prev => [executionResult, ...prev.slice(0, 4)]) // Keep last 5 executions
      
      // Update iframe for HTML/CSS
      if (language === 'html' || language === 'css') {
        updatePreview(executionResult)
      }
      
      onExecutionChange?.(executionResult)
    } catch (error) {
      const errorResult: ExecutionResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      }
      setResult(errorResult)
      onExecutionChange?.(errorResult)
    } finally {
      setIsExecuting(false)
    }
  }

  const updatePreview = (executionResult: ExecutionResult) => {
    if (!iframeRef.current) return
    
    const iframe = iframeRef.current
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    
    if (!doc) return
    
    if (language === 'html') {
      doc.open()
      doc.write(code)
      doc.close()
    } else if (language === 'css') {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>${code}</style>
        </head>
        <body>
          <div class="preview-container">
            <h1>CSS Preview</h1>
            <p>This is a paragraph to demonstrate CSS styling.</p>
            <div class="demo-box">Demo Box</div>
            <button>Demo Button</button>
          </div>
        </body>
        </html>
      `
      doc.open()
      doc.write(htmlContent)
      doc.close()
    }
  }

  const clearPreview = () => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write('')
        doc.close()
      }
    }
  }

  const getStatusIcon = (result: ExecutionResult | null) => {
    if (!result) return <Clock className="w-4 h-4 text-gray-400" />
    if (result.success) return <CheckCircle className="w-4 h-4 text-green-500" />
    return <AlertCircle className="w-4 h-4 text-red-500" />
  }

  const getStatusColor = (result: ExecutionResult | null) => {
    if (!result) return 'gray'
    if (result.success) return 'green'
    return 'red'
  }

  const formatExecutionTime = (time: number) => {
    return `${time}ms`
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <span>Live Preview</span>
            <Badge variant="outline">{language.toUpperCase()}</Badge>
            {result && (
              <Badge variant="outline" className={`text-${getStatusColor(result)}-600`}>
                {getStatusIcon(result)}
                <span className="ml-1">
                  {result.success ? 'Success' : 'Error'}
                </span>
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={executeUserCode}
              disabled={isExecuting || !code.trim()}
            >
              {isExecuting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span className="ml-1">Run</span>
            </Button>
            
            {(language === 'html' || language === 'css') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewVisible(!isPreviewVisible)}
              >
                {isPreviewVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearPreview}
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {result && (
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Execution time: {formatExecutionTime(result.executionTime)}</span>
            {result.memoryUsage && (
              <span>Memory: {result.memoryUsage}MB</span>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <Badge variant="secondary" className="text-yellow-600">
                {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Visual Preview (for HTML/CSS) */}
        {(language === 'html' || language === 'css') && isPreviewVisible && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-sm font-medium border-b flex items-center justify-between">
              <span>Visual Preview</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const iframe = iframeRef.current
                  if (iframe) {
                    const win = iframe.contentWindow
                    if (win) {
                      win.open('', '_blank')
                    }
                  }
                }}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
            <iframe
              ref={iframeRef}
              className="w-full h-64 border-0"
              sandbox="allow-same-origin allow-scripts"
              title="Live Preview"
            />
          </div>
        )}
        
        {/* Console Output */}
        {showConsole && result && (
          <div className="space-y-2">
            <Separator />
            <div className="text-sm font-medium">Console Output</div>
            
            {result.output && (
              <div className="bg-gray-50 border rounded p-3 font-mono text-sm overflow-auto max-h-32">
                <pre className="whitespace-pre-wrap">{result.output}</pre>
              </div>
            )}
            
            {result.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 font-mono text-sm">
                <div className="text-red-600 font-medium mb-1">Error:</div>
                <pre className="whitespace-pre-wrap text-red-800">{result.error}</pre>
              </div>
            )}
            
            {result.warnings && result.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="text-yellow-600 font-medium mb-1">Warnings:</div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Execution History */}
        {executionHistory.length > 1 && (
          <div className="space-y-2">
            <Separator />
            <div className="text-sm font-medium">Recent Executions</div>
            <div className="space-y-1">
              {executionHistory.slice(1).map((execution, index) => (
                <div key={index} className="flex items-center justify-between text-xs text-gray-500 py-1">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(execution)}
                    <span>{execution.success ? 'Success' : 'Error'}</span>
                  </div>
                  <span>{formatExecutionTime(execution.executionTime)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LivePreview
