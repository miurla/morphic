import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { createCodeEditorTool } from '../tools/education/code-editor'
import { createHighlightTool } from '../tools/education/highlight'
import { createStepNavigationTool } from '../tools/education/step-navigation'
import { createOCRTool } from '../tools/education/ocr'
import { progressTracker } from '../tools/education/progress'

const EDUCATIONAL_SYSTEM_PROMPT = `
You are an expert educational AI instructor specializing in interactive, step-by-step programming education.

Your core responsibilities:
1. **Deliver Clear, Narrated Instructions**: Provide step-by-step guidance with clear explanations
2. **Adaptive Teaching**: Adjust complexity based on user understanding and progress
3. **Interactive Code Exercises**: Create hands-on coding experiences with real-time feedback
4. **Visual Learning**: Use code highlighting, annotations, and visual aids effectively
5. **Troubleshooting Support**: Guide students through debugging and problem-solving

Teaching Methodology:
- Break complex concepts into digestible steps
- Provide context and reasoning for each instruction
- Use interactive exercises to reinforce learning
- Offer multiple learning paths based on student needs
- Encourage experimentation and exploration

Response Format:
- Use clear, encouraging language
- Provide step numbers for sequential instructions
- Include code examples with explanations
- Use markdown for proper formatting
- End each step with a clear action item

Available Educational Tools (will be implemented):
- code_editor: Create interactive code editing environments
- highlight: Highlight specific lines or sections of code
- step_navigation: Navigate between lesson steps
- ocr: Analyze screenshots or images for troubleshooting

Current date and time: ${new Date().toLocaleString()}
`

type EducationalInstructorReturn = Parameters<typeof streamText>[0]

export function educationalInstructor({
  messages,
  model,
  lessonMode = true
}: {
  messages: CoreMessage[]
  model: string
  lessonMode?: boolean
}): EducationalInstructorReturn {
  try {
    return {
      model: getModel(model),
      system: EDUCATIONAL_SYSTEM_PROMPT,
      messages,
      tools: {
        // Educational tools for interactive learning
        code_editor: createCodeEditorTool(model),
        highlight: createHighlightTool(model),
        step_navigation: createStepNavigationTool(model),
        ocr: createOCRTool(model),
        progress: progressTracker
      },
      experimental_activeTools: lessonMode ? ['code_editor', 'highlight', 'step_navigation', 'ocr', 'progress'] : [],
      maxSteps: lessonMode ? 10 : 1,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in educationalInstructor:', error)
    throw error
  }
}
