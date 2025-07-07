import chatIntegratedLesson from '@/lib/education/chat-integrated-lesson'
import { comprehensiveSampleLesson } from '@/lib/education/comprehensive-sample-lesson'
import { lessonDatabase } from '@/lib/education/lesson-database'
import { z } from 'zod'

// Educational lesson tool schema
const EducationalLessonToolSchema = z.object({
  lessonId: z.string().describe('The ID of the lesson to start'),
  stepId: z.string().optional().describe('Specific step to start from'),
  mode: z.enum(['chat', 'editor', 'preview']).default('chat').describe('Initial interface mode')
})

export type EducationalLessonToolParams = z.infer<typeof EducationalLessonToolSchema>

/**
 * Educational lesson tool that launches interactive lessons as chat artifacts
 */
export const createEducationalLessonTool = (model: string) => ({
  description: `Start an interactive educational lesson within the chat interface. 
  This tool creates a morphing interface that seamlessly transitions between:
  - Chat mode for explanations and discussions
  - Editor mode for hands-on coding exercises  
  - Preview mode for seeing results and outputs
  
  The lesson appears as an interactive artifact in the chat, just like search results or images.`,
  
  parameters: EducationalLessonToolSchema,
  
  execute: async ({ lessonId, stepId, mode = 'chat' }: EducationalLessonToolParams) => {
    try {
      // Get the lesson from the database
      let lesson = await lessonDatabase.getLessonById(lessonId)
      
      // If not found, check special lessons
      if (!lesson) {
        if (lessonId === 'comprehensive-web-development-masterclass') {
          lesson = comprehensiveSampleLesson
        } else if (lessonId === 'chat-integrated-demo') {
          lesson = chatIntegratedLesson
        }
      }
      
      if (!lesson) {
        throw new Error(`Lesson with ID "${lessonId}" not found`)
      }

      // Find the starting step
      const startingStepIndex = stepId 
        ? lesson.steps.findIndex((step: any) => step.id === stepId)
        : 0
      
      const currentStep = Math.max(0, startingStepIndex)
      
      // Return the lesson data as an artifact
      return {
        lesson: {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          difficulty: lesson.difficulty,
          estimatedTime: lesson.estimatedDuration,
          steps: lesson.steps,
          currentStep,
          progress: Math.round(((currentStep + 1) / lesson.steps.length) * 100),
          mode
        },
        artifactType: 'educational_lesson',
        metadata: {
          lessonId,
          stepId,
          mode,
          totalSteps: lesson.steps.length,
          currentStepId: lesson.steps[currentStep]?.id,
          currentStepType: lesson.steps[currentStep]?.type
        }
      }
    } catch (error) {
      console.error('Error in educational lesson tool:', error)
      throw error
    }
  }
})

// Quick lesson starter tool for common requests
export const createQuickLessonTool = (model: string) => ({
  description: `Start a quick educational lesson based on a topic or skill level.
  This is a shortcut for users who want to learn about a specific topic without knowing lesson IDs.`,
  
  parameters: z.object({
    topic: z.string().describe('The programming topic to learn about (e.g., "javascript", "html", "css", "web development")'),
    level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner').describe('Skill level')
  }),
  
  execute: async ({ topic, level }: { topic: string; level: string }) => {
    try {
      // Map topics to lesson IDs
      const topicMapping: Record<string, string> = {
        'javascript': 'javascript-variables',
        'html': 'html-basics',
        'css': 'css-fundamentals',
        'web development': 'comprehensive-web-development-masterclass',
        'comprehensive': 'comprehensive-web-development-masterclass',
        'interactive': 'comprehensive-web-development-masterclass',
        'demo': 'chat-integrated-demo',
        'chat': 'chat-integrated-demo',
        'learning': 'chat-integrated-demo',
        'tutorial': 'chat-integrated-demo'
      }
      
      const lessonId = topicMapping[topic.toLowerCase()] || 'chat-integrated-demo'
      
      // Use the educational lesson tool
      const lessonTool = createEducationalLessonTool(model)
      return await lessonTool.execute({ lessonId, mode: 'chat' })
    } catch (error) {
      console.error('Error in quick lesson tool:', error)
      throw error
    }
  }
})
