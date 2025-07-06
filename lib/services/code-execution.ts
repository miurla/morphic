import { z } from 'zod'

// Execution context schema
const ExecutionContextSchema = z.object({
  language: z.enum(['javascript', 'python', 'html', 'css', 'typescript']),
  code: z.string(),
  input: z.string().optional(),
  timeout: z.number().default(5000),
  memoryLimit: z.number().default(128), // MB
  allowNetwork: z.boolean().default(false),
  allowFileSystem: z.boolean().default(false)
})

// Execution result schema
const ExecutionResultSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
  executionTime: z.number(),
  memoryUsage: z.number().optional(),
  exitCode: z.number().optional(),
  warnings: z.array(z.string()).optional()
})

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>

// Security sandbox configuration
const SECURITY_CONFIG = {
  maxExecutionTime: 10000, // 10 seconds
  maxMemoryUsage: 256, // 256 MB
  allowedGlobals: ['console', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean'],
  blockedModules: ['fs', 'path', 'os', 'child_process', 'cluster', 'crypto'],
  maxOutputLength: 50000 // 50KB
}

export class CodeExecutionService {
  private static instance: CodeExecutionService
  private workers: Map<string, Worker> = new Map()
  private executionQueue: Array<{
    id: string
    context: ExecutionContext
    resolve: (result: ExecutionResult) => void
    reject: (error: Error) => void
  }> = []

  static getInstance(): CodeExecutionService {
    if (!CodeExecutionService.instance) {
      CodeExecutionService.instance = new CodeExecutionService()
    }
    return CodeExecutionService.instance
  }

  /**
   * Execute code in a sandboxed environment
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const validatedContext = ExecutionContextSchema.parse(context)
    
    // Apply security limits
    const secureContext = {
      ...validatedContext,
      timeout: Math.min(validatedContext.timeout, SECURITY_CONFIG.maxExecutionTime),
      memoryLimit: Math.min(validatedContext.memoryLimit, SECURITY_CONFIG.maxMemoryUsage)
    }

    const startTime = Date.now()
    
    try {
      switch (secureContext.language) {
        case 'javascript':
        case 'typescript':
          return await this.executeJavaScript(secureContext, startTime)
        case 'python':
          return await this.executePython(secureContext, startTime)
        case 'html':
          return await this.executeHTML(secureContext, startTime)
        case 'css':
          return await this.executeCSS(secureContext, startTime)
        default:
          throw new Error(`Unsupported language: ${secureContext.language}`)
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Execute JavaScript code in a sandboxed environment
   */
  private async executeJavaScript(context: ExecutionContext, startTime: number): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const executionId = `js_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create a sandboxed execution context
      const sandboxedCode = this.createJavaScriptSandbox(context.code)
      
      try {
        // Capture console output
        const consoleOutput: string[] = []
        const originalConsole = console.log
        
        const mockConsole = {
          log: (...args: any[]) => {
            consoleOutput.push(args.map(arg => String(arg)).join(' '))
          },
          error: (...args: any[]) => {
            consoleOutput.push('ERROR: ' + args.map(arg => String(arg)).join(' '))
          },
          warn: (...args: any[]) => {
            consoleOutput.push('WARNING: ' + args.map(arg => String(arg)).join(' '))
          }
        }
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Code execution timed out'))
        }, context.timeout)
        
        // Execute the code
        const func = new Function('console', 'input', sandboxedCode)
        const result = func(mockConsole, context.input || '')
        
        clearTimeout(timeoutId)
        
        const executionTime = Date.now() - startTime
        const output = consoleOutput.join('\n')
        
        resolve({
          success: true,
          output: output || (result !== undefined ? String(result) : ''),
          executionTime,
          warnings: this.detectJavaScriptWarnings(context.code)
        })
      } catch (error) {
        resolve({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'JavaScript execution error',
          executionTime: Date.now() - startTime
        })
      }
    })
  }

  /**
   * Create a sandboxed JavaScript execution environment
   */
  private createJavaScriptSandbox(code: string): string {
    // Remove dangerous functions and modules
    const sanitizedCode = code
      .replace(/eval\s*\(/g, '(function() { throw new Error("eval is not allowed"); })(')
      .replace(/Function\s*\(/g, '(function() { throw new Error("Function constructor is not allowed"); })(')
      .replace(/require\s*\(/g, '(function() { throw new Error("require is not allowed"); })(')
      .replace(/import\s+/g, '// import ')
      .replace(/export\s+/g, '// export ')
    
    // Wrap in try-catch for better error handling
    return `
      try {
        ${sanitizedCode}
      } catch (error) {
        console.error(error.message);
        throw error;
      }
    `
  }

  /**
   * Execute Python code (mock implementation - would use a real Python runtime in production)
   */
  private async executePython(context: ExecutionContext, startTime: number): Promise<ExecutionResult> {
    // This is a mock implementation. In production, you would use:
    // - Pyodide for client-side Python execution
    // - A containerized Python runtime
    // - A serverless function with Python support
    
    return new Promise((resolve) => {
      const executionTime = Date.now() - startTime
      
      // Mock Python execution
      if (context.code.includes('print(')) {
        const printMatches = context.code.match(/print\((.*?)\)/g) || []
        const output = printMatches.map(match => {
          const content = match.replace(/print\(['"]?([^'"]*?)['"]?\)/, '$1')
          return content
        }).join('\n')
        
        resolve({
          success: true,
          output,
          executionTime,
          warnings: ['Python execution is currently mocked in the browser']
        })
      } else {
        resolve({
          success: true,
          output: 'Python code executed successfully (mock)',
          executionTime,
          warnings: ['Python execution is currently mocked in the browser']
        })
      }
    })
  }

  /**
   * Execute HTML code
   */
  private async executeHTML(context: ExecutionContext, startTime: number): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const executionTime = Date.now() - startTime
      
      try {
        // Create a temporary iframe to render HTML
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)
        
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) {
          throw new Error('Could not access iframe document')
        }
        
        // Write HTML content
        doc.open()
        doc.write(context.code)
        doc.close()
        
        // Extract rendered content
        const bodyContent = doc.body?.innerHTML || ''
        const hasJavaScript = context.code.includes('<script>')
        
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 100)
        
        resolve({
          success: true,
          output: `HTML rendered successfully. Body content: ${bodyContent.substring(0, 200)}${bodyContent.length > 200 ? '...' : ''}`,
          executionTime,
          warnings: hasJavaScript ? ['HTML contains JavaScript - execution may be limited'] : undefined
        })
      } catch (error) {
        resolve({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'HTML execution error',
          executionTime: Date.now() - startTime
        })
      }
    })
  }

  /**
   * Execute CSS code
   */
  private async executeCSS(context: ExecutionContext, startTime: number): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const executionTime = Date.now() - startTime
      
      try {
        // Validate CSS syntax
        const cssRules = this.parseCSSRules(context.code)
        const validRules = cssRules.filter(rule => rule.valid)
        const invalidRules = cssRules.filter(rule => !rule.valid)
        
        const output = [
          `CSS parsed successfully.`,
          `Valid rules: ${validRules.length}`,
          `Invalid rules: ${invalidRules.length}`
        ].join('\n')
        
        const warnings = invalidRules.length > 0 
          ? [`Found ${invalidRules.length} invalid CSS rules`]
          : undefined
        
        resolve({
          success: true,
          output,
          executionTime,
          warnings
        })
      } catch (error) {
        resolve({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'CSS execution error',
          executionTime: Date.now() - startTime
        })
      }
    })
  }

  /**
   * Parse CSS rules for validation
   */
  private parseCSSRules(css: string): Array<{ selector: string, valid: boolean }> {
    const rules: Array<{ selector: string, valid: boolean }> = []
    
    // Simple CSS parsing (in production, use a proper CSS parser)
    const ruleMatches = css.match(/[^{}]+\{[^{}]*\}/g) || []
    
    ruleMatches.forEach(rule => {
      const selectorMatch = rule.match(/^([^{]+)\{/)
      if (selectorMatch) {
        const selector = selectorMatch[1].trim()
        const isValid = this.isValidCSSSelector(selector)
        rules.push({ selector, valid: isValid })
      }
    })
    
    return rules
  }

  /**
   * Validate CSS selector
   */
  private isValidCSSSelector(selector: string): boolean {
    try {
      document.querySelector(selector)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Detect JavaScript warnings
   */
  private detectJavaScriptWarnings(code: string): string[] {
    const warnings: string[] = []
    
    // Check for common issues
    if (code.includes('var ')) {
      warnings.push('Consider using "let" or "const" instead of "var"')
    }
    
    if (code.includes('==') && !code.includes('===')) {
      warnings.push('Consider using "===" for strict equality comparison')
    }
    
    if (code.includes('alert(')) {
      warnings.push('Using alert() may not work in all environments')
    }
    
    return warnings
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number
    averageExecutionTime: number
    successRate: number
  } {
    // This would be implemented with actual execution tracking
    return {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 100
    }
  }

  /**
   * Clear execution cache and cleanup
   */
  cleanup(): void {
    this.workers.clear()
    this.executionQueue = []
  }
}

// Export singleton instance
export const codeExecutionService = CodeExecutionService.getInstance()

// Helper function for easy code execution
export const executeCode = async (
  language: ExecutionContext['language'],
  code: string,
  input?: string
): Promise<ExecutionResult> => {
  return codeExecutionService.execute({
    language,
    code,
    input,
    timeout: 5000,
    memoryLimit: 128,
    allowNetwork: false,
    allowFileSystem: false
  })
}
