import { tool } from 'ai'
import { z } from 'zod'

const stepNavigationSchema = z.object({
  action: z.enum(['next', 'previous', 'jump', 'reset', 'complete']),
  stepId: z.string().optional(), // Required for 'jump' action
  lessonId: z.string(),
  validate: z.boolean().default(true), // Whether to validate current step before moving
  description: z.string().optional()
})

type StepNavigationParams = z.infer<typeof stepNavigationSchema>

export const createStepNavigationTool = (model: string) => {
  return tool({
    description: `Navigate between lesson steps, manage lesson progress, and control the flow of educational content. Handles step validation, progress tracking, and lesson state management.`,
    parameters: stepNavigationSchema,
    execute: async (params: StepNavigationParams) => {
      const {
        action,
        stepId,
        lessonId,
        validate,
        description
      } = params

      // Generate unique navigation ID
      const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create navigation configuration
      const navigationConfig = {
        id: navigationId,
        action,
        lessonId,
        targetStepId: stepId,
        validate,
        timestamp: new Date().toISOString(),
        description
      }

      // Mock lesson progress state (in real implementation, this would come from Redis/database)
      const mockLessonState = {
        currentStep: 2,
        totalSteps: 5,
        completedSteps: [1, 2],
        availableSteps: [1, 2, 3],
        progress: 40,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }

      // Handle different navigation actions
      let result: any = {
        type: 'step_navigation',
        title: `Step Navigation: ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        description: description || `Navigating to ${action} step`,
        config: navigationConfig,
        metadata: {
          createdAt: new Date().toISOString(),
          action,
          lessonId,
          navigationId,
          model
        }
      }

      switch (action) {
        case 'next':
          if (mockLessonState.currentStep < mockLessonState.totalSteps) {
            const nextStep = mockLessonState.currentStep + 1
            result.data = {
              ...mockLessonState,
              currentStep: nextStep,
              completedSteps: [...mockLessonState.completedSteps, mockLessonState.currentStep],
              availableSteps: [...mockLessonState.availableSteps, nextStep],
              progress: Math.round((nextStep / mockLessonState.totalSteps) * 100)
            }
            result.success = true
            result.message = `Advanced to step ${nextStep}`
          } else {
            result.success = false
            result.message = 'Already at the last step'
          }
          break

        case 'previous':
          if (mockLessonState.currentStep > 1) {
            const prevStep = mockLessonState.currentStep - 1
            result.data = {
              ...mockLessonState,
              currentStep: prevStep,
              progress: Math.round((prevStep / mockLessonState.totalSteps) * 100)
            }
            result.success = true
            result.message = `Returned to step ${prevStep}`
          } else {
            result.success = false
            result.message = 'Already at the first step'
          }
          break

        case 'jump':
          if (!stepId) {
            result.success = false
            result.message = 'Step ID is required for jump action'
            break
          }
          
          const targetStepNumber = parseInt(stepId.replace('step-', ''))
          if (targetStepNumber >= 1 && targetStepNumber <= mockLessonState.totalSteps) {
            result.data = {
              ...mockLessonState,
              currentStep: targetStepNumber,
              progress: Math.round((targetStepNumber / mockLessonState.totalSteps) * 100)
            }
            result.success = true
            result.message = `Jumped to step ${targetStepNumber}`
          } else {
            result.success = false
            result.message = 'Invalid step ID'
          }
          break

        case 'reset':
          result.data = {
            ...mockLessonState,
            currentStep: 1,
            completedSteps: [],
            availableSteps: [1],
            progress: 0,
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          }
          result.success = true
          result.message = 'Lesson reset to beginning'
          break

        case 'complete':
          result.data = {
            ...mockLessonState,
            currentStep: mockLessonState.totalSteps,
            completedSteps: Array.from({ length: mockLessonState.totalSteps }, (_, i) => i + 1),
            availableSteps: Array.from({ length: mockLessonState.totalSteps }, (_, i) => i + 1),
            progress: 100,
            completedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          }
          result.success = true
          result.message = 'Lesson completed!'
          break

        default:
          result.success = false
          result.message = 'Unknown navigation action'
      }

      // Add validation results if requested
      if (validate && action !== 'reset') {
        result.validation = {
          passed: true, // Mock validation - in real implementation, this would check exercise completion
          issues: [],
          suggestions: []
        }
      }

      return result
    }
  })
}

// Helper function to create step navigation with progress tracking
export const createStepNavigationWithProgress = (lessonId: string, currentStep: number, totalSteps: number) => {
  const canGoNext = currentStep < totalSteps
  const canGoPrevious = currentStep > 1
  const progress = Math.round((currentStep / totalSteps) * 100)

  return {
    lessonId,
    currentStep,
    totalSteps,
    progress,
    canGoNext,
    canGoPrevious,
    actions: {
      next: canGoNext ? { action: 'next' as const, lessonId } : null,
      previous: canGoPrevious ? { action: 'previous' as const, lessonId } : null,
      reset: { action: 'reset' as const, lessonId },
      complete: currentStep === totalSteps ? { action: 'complete' as const, lessonId } : null
    }
  }
}
