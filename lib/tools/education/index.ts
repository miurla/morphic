import { createCodeEditorTool, createEducationalCodeEditor } from './code-editor'
import { createHighlightTool, createEducationalHighlight } from './highlight'
import { createStepNavigationTool, createStepNavigationWithProgress } from './step-navigation'
import { createOCRTool, createEducationalOCR } from './ocr'
import { progressTracker } from './progress'

export { createCodeEditorTool, createEducationalCodeEditor } from './code-editor'
export { createHighlightTool, createEducationalHighlight } from './highlight'
export { createStepNavigationTool, createStepNavigationWithProgress } from './step-navigation'
export { createOCRTool, createEducationalOCR } from './ocr'
export { progressTracker } from './progress'

// Educational tool types
export type EducationalTool = 'code_editor' | 'highlight' | 'step_navigation' | 'ocr' | 'progress'

// Helper function to create all educational tools at once
export const createEducationalTools = (model: string) => {
  return {
    code_editor: createCodeEditorTool(model),
    highlight: createHighlightTool(model),
    step_navigation: createStepNavigationTool(model),
    ocr: createOCRTool(model),
    progress: progressTracker
  }
}

// Tool configuration presets for different educational scenarios
export const educationalToolPresets = {
  beginner: {
    tools: ['code_editor', 'highlight', 'step_navigation'] as EducationalTool[],
    settings: {
      code_editor: { fontSize: 16, theme: 'vs-light' },
      highlight: { color: 'yellow', animation: 'fade' },
      step_navigation: { validate: true }
    }
  },
  intermediate: {
    tools: ['code_editor', 'highlight', 'step_navigation', 'ocr'] as EducationalTool[],
    settings: {
      code_editor: { fontSize: 14, theme: 'vs-dark' },
      highlight: { color: 'blue', animation: 'none' },
      step_navigation: { validate: true }
    }
  },
  advanced: {
    tools: ['code_editor', 'highlight', 'step_navigation', 'ocr'] as EducationalTool[],
    settings: {
      code_editor: { fontSize: 12, theme: 'vs-dark' },
      highlight: { color: 'green', animation: 'none' },
      step_navigation: { validate: false }
    }
  }
}
