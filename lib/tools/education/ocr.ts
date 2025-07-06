import { tool } from 'ai'
import { z } from 'zod'

const ocrSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageData: z.string().optional(), // Base64 encoded image data
  analysisType: z.enum(['text_extraction', 'error_detection', 'code_analysis', 'ui_elements']).default('text_extraction'),
  language: z.enum(['auto', 'english', 'code']).default('auto'),
  description: z.string().optional()
})

type OCRParams = z.infer<typeof ocrSchema>

export const createOCRTool = (model: string) => {
  return tool({
    description: `Analyze screenshots, error messages, and code images using OCR technology. Perfect for troubleshooting student issues, extracting text from screenshots, and analyzing programming problems.`,
    parameters: ocrSchema,
    execute: async (params: OCRParams) => {
      const {
        imageUrl,
        imageData,
        analysisType,
        language,
        description
      } = params

      // Generate unique OCR analysis ID
      const ocrId = `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create OCR configuration
      const ocrConfig = {
        id: ocrId,
        source: imageUrl ? 'url' : 'data',
        imageUrl,
        hasImageData: !!imageData,
        analysisType,
        language,
        timestamp: new Date().toISOString(),
        description
      }

      // Mock OCR results (in real implementation, this would use actual OCR service)
      const mockResults = {
        text_extraction: {
          extractedText: "console.log('Hello, World!');\nlet message = 'Welcome to JavaScript';\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}",
          confidence: 0.95,
          wordCount: 12,
          lineCount: 4,
          detectedLanguage: 'javascript'
        },
        error_detection: {
          errors: [
            {
              type: 'SyntaxError',
              message: 'Unexpected token }',
              line: 3,
              column: 15,
              severity: 'error'
            },
            {
              type: 'Warning',
              message: 'Unused variable: message',
              line: 2,
              column: 5,
              severity: 'warning'
            }
          ],
          suggestions: [
            'Check for missing opening bracket on line 3',
            'Consider using the variable message or remove it',
            'Ensure proper bracket matching throughout the code'
          ]
        },
        code_analysis: {
          language: 'javascript',
          functions: ['greet'],
          variables: ['message'],
          imports: [],
          exports: [],
          complexity: 'beginner',
          issues: [
            {
              type: 'best_practice',
              message: 'Consider using const instead of let for variables that don\'t change',
              line: 2
            }
          ]
        },
        ui_elements: {
          buttons: ['Run Code', 'Reset', 'Save'],
          inputs: ['code-editor', 'output-console'],
          errors: ['error-display-panel'],
          layout: 'split-pane'
        }
      }

      const analysisResult = mockResults[analysisType as keyof typeof mockResults]

      return {
        type: 'ocr_analysis',
        title: `OCR Analysis: ${analysisType.replace('_', ' ').toUpperCase()}`,
        description: description || `OCR analysis of ${analysisType.replace('_', ' ')}`,
        config: ocrConfig,
        results: analysisResult,
        actions: {
          reanalyze: true,
          export: true,
          highlight: analysisType === 'error_detection',
          fix: analysisType === 'error_detection' || analysisType === 'code_analysis'
        },
        metadata: {
          createdAt: new Date().toISOString(),
          analysisType,
          language,
          confidence: (analysisResult as any).confidence || 0.9,
          ocrId,
          model
        }
      }
    }
  })
}

// Helper function to create OCR analysis for common educational scenarios
export const createEducationalOCR = (scenario: string, imageSource: string) => {
  const scenarios = {
    error_screenshot: {
      analysisType: 'error_detection' as const,
      description: 'Analyzing error message from student screenshot'
    },
    code_review: {
      analysisType: 'code_analysis' as const,
      description: 'Reviewing student code from image'
    },
    text_extraction: {
      analysisType: 'text_extraction' as const,
      description: 'Extracting text from educational material'
    },
    ui_analysis: {
      analysisType: 'ui_elements' as const,
      description: 'Analyzing user interface elements'
    }
  }

  const config = scenarios[scenario as keyof typeof scenarios] || scenarios.text_extraction

  return {
    imageUrl: imageSource.startsWith('http') ? imageSource : undefined,
    imageData: imageSource.startsWith('data:') ? imageSource : undefined,
    analysisType: config.analysisType,
    language: 'auto' as const,
    description: config.description
  }
}
