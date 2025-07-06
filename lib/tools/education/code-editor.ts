import { tool } from 'ai'
import { z } from 'zod'

const codeEditorSchema = z.object({
  language: z.enum(['javascript', 'python', 'html', 'css', 'typescript']),
  initialCode: z.string().optional(),
  readOnlyLines: z.array(z.number()).optional(),
  highlightLines: z.array(z.number()).optional(),
  theme: z.enum(['vs-dark', 'vs-light', 'hc-black']).default('vs-dark'),
  showLineNumbers: z.boolean().default(true),
  wordWrap: z.enum(['on', 'off', 'wordWrapColumn']).default('on'),
  fontSize: z.number().default(14),
  tabSize: z.number().default(2),
  description: z.string().optional()
})

type CodeEditorParams = z.infer<typeof codeEditorSchema>

export const createCodeEditorTool = (model: string) => {
  return tool({
    description: `Create an interactive code editor for educational purposes. This tool sets up a Monaco-based code editor with syntax highlighting, IntelliSense, and customizable features for learning programming.`,
    parameters: codeEditorSchema,
    execute: async (params: CodeEditorParams) => {
      const {
        language,
        initialCode = '',
        readOnlyLines = [],
        highlightLines = [],
        theme,
        showLineNumbers,
        wordWrap,
        fontSize,
        tabSize,
        description
      } = params
      // Generate unique editor ID
      const editorId = `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create editor configuration
      const editorConfig = {
        id: editorId,
        language,
        value: initialCode,
        theme,
        options: {
          lineNumbers: showLineNumbers ? 'on' : 'off',
          wordWrap,
          fontSize,
          tabSize,
          readOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          contextmenu: false,
          selectOnLineNumbers: true,
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          renderWhitespace: 'selection',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          wordBasedSuggestions: 'allDocuments',
          parameterHints: { enabled: true },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true
          }
        },
        readOnlyLines,
        highlightLines,
        description
      }

      // Language-specific configuration
      const languageConfig = {
        javascript: {
          libraries: ['dom', 'es6'],
          snippets: ['console.log', 'function', 'const', 'let', 'var', 'if', 'for', 'while'],
          validation: true
        },
        typescript: {
          libraries: ['dom', 'es6'],
          snippets: ['console.log', 'function', 'const', 'let', 'interface', 'type', 'class'],
          validation: true,
          strictMode: true
        },
        python: {
          libraries: ['builtins'],
          snippets: ['print', 'def', 'if', 'for', 'while', 'class', 'import'],
          validation: true
        },
        html: {
          emmet: true,
          autoClosingTags: true,
          snippets: ['html5', 'div', 'span', 'p', 'a', 'img', 'form', 'input'],
          validation: true
        },
        css: {
          emmet: true,
          snippets: ['color', 'background', 'margin', 'padding', 'flex', 'grid'],
          validation: true
        }
      }

      return {
        type: 'code_editor',
        title: `Interactive ${language.toUpperCase()} Code Editor`,
        description: description || `A fully-featured code editor for ${language} programming`,
        config: editorConfig,
        languageConfig: languageConfig[language as keyof typeof languageConfig],
        actions: {
          run: language === 'javascript' || language === 'typescript',
          format: true,
          save: true,
          reset: true,
          copy: true,
          fullscreen: true
        },
        metadata: {
          createdAt: new Date().toISOString(),
          language,
          editorId,
          model
        }
      }
    }
  })
}

// Helper function to create editor with common educational presets
export const createEducationalCodeEditor = (language: string, lessonType: string) => {
  const presets = {
    beginner: {
      fontSize: 16,
      theme: 'vs-light',
      showLineNumbers: true,
      wordWrap: 'on'
    },
    intermediate: {
      fontSize: 14,
      theme: 'vs-dark',
      showLineNumbers: true,
      wordWrap: 'off'
    },
    advanced: {
      fontSize: 12,
      theme: 'vs-dark',
      showLineNumbers: true,
      wordWrap: 'off'
    }
  }

  const preset = presets[lessonType as keyof typeof presets] || presets.beginner

  return {
    language: language as any,
    theme: preset.theme as any,
    fontSize: preset.fontSize,
    showLineNumbers: preset.showLineNumbers,
    wordWrap: preset.wordWrap as any,
    tabSize: 2
  }
}
