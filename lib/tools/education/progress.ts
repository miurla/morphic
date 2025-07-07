import { LessonProgress, ProgressSchema } from '@/lib/education/schema'
import { redis } from '@/lib/redis'
import { tool } from 'ai'
import { z } from 'zod'

// Progress tracking tool for educational lessons
export const progressTracker = tool({
  description: 'Track and manage student progress through educational lessons',
  parameters: z.object({
    action: z.enum(['save', 'load', 'update', 'reset']).describe('The action to perform'),
    userId: z.string().describe('The user ID'),
    lessonId: z.string().describe('The lesson ID'),
    data: z.object({
      currentStep: z.number().optional(),
      completedSteps: z.array(z.number()).optional(),
      score: z.number().optional(),
      timeSpent: z.number().optional(),
      lastAccessed: z.string().optional(),
      achievements: z.array(z.string()).optional(),
      codeSubmissions: z.array(z.object({
        stepId: z.number(),
        code: z.string(),
        timestamp: z.string(),
        isCorrect: z.boolean().optional()
      })).optional(),
      mistakes: z.array(z.object({
        stepId: z.number(),
        error: z.string(),
        timestamp: z.string(),
        resolved: z.boolean().optional()
      })).optional()
    }).optional().describe('Progress data to save/update')
  }),
  execute: async ({ action, userId, lessonId, data }) => {
    const progressKey = `progress:${userId}:${lessonId}`
    
    try {
      switch (action) {
        case 'save':
        case 'update':
          if (!data) {
            throw new Error('Progress data is required for save/update actions')
          }
          
          const progressData: LessonProgress = {
            userId,
            lessonId,
            currentStep: data.currentStep || 0,
            completedSteps: data.completedSteps || [],
            score: data.score || 0,
            timeSpent: data.timeSpent || 0,
            lastAccessed: data.lastAccessed || new Date().toISOString(),
            achievements: data.achievements || [],
            codeSubmissions: data.codeSubmissions || [],
            mistakes: data.mistakes || []
          }
          
          // Validate progress data
          const validated = ProgressSchema.parse(progressData)
          
          // Save to Redis with expiration (30 days)
          await redis.setex(progressKey, 30 * 24 * 60 * 60, JSON.stringify(validated))
          
          return {
            success: true,
            message: `Progress ${action}d successfully`,
            data: validated
          }
        
        case 'load':
          const savedProgress = await redis.get(progressKey)
          if (!savedProgress) {
            return {
              success: false,
              message: 'No progress found for this lesson',
              data: null
            }
          }
          
          const parsed = JSON.parse(savedProgress)
          const validatedProgress = ProgressSchema.parse(parsed)
          
          return {
            success: true,
            message: 'Progress loaded successfully',
            data: validatedProgress
          }
        
        case 'reset':
          await redis.del(progressKey)
          return {
            success: true,
            message: 'Progress reset successfully',
            data: null
          }
        
        default:
          throw new Error(`Unknown action: ${action}`)
      }
    } catch (error) {
      console.error('Progress tracking error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null
      }
    }
  }
})

// Helper function to calculate lesson completion percentage
export const calculateCompletionPercentage = (progress: LessonProgress, totalSteps: number): number => {
  if (totalSteps === 0) return 0
  return Math.round((progress.completedSteps.length / totalSteps) * 100)
}

// Helper function to get lesson statistics
export const getLessonStats = (progress: LessonProgress) => {
  const totalSubmissions = progress.codeSubmissions.length
  const correctSubmissions = progress.codeSubmissions.filter(s => s.isCorrect).length
  const totalMistakes = progress.mistakes.length
  const resolvedMistakes = progress.mistakes.filter(m => m.resolved).length
  
  return {
    totalSubmissions,
    correctSubmissions,
    accuracyRate: totalSubmissions > 0 ? Math.round((correctSubmissions / totalSubmissions) * 100) : 0,
    totalMistakes,
    resolvedMistakes,
    resolutionRate: totalMistakes > 0 ? Math.round((resolvedMistakes / totalMistakes) * 100) : 0,
    timeSpent: progress.timeSpent,
    achievements: progress.achievements.length
  }
}

// Helper function to update progress with new completion
export const updateStepCompletion = async (
  userId: string, 
  lessonId: string, 
  stepId: number,
  isCorrect: boolean = true,
  code?: string
) => {
  const progressKey = `progress:${userId}:${lessonId}`
  
  try {
    // Load existing progress
    const savedProgress = await redis.get(progressKey)
    let progress: LessonProgress
    
    if (savedProgress) {
      progress = ProgressSchema.parse(JSON.parse(savedProgress))
    } else {
      // Create new progress entry
      progress = {
        userId,
        lessonId,
        currentStep: 0,
        completedSteps: [],
        score: 0,
        timeSpent: 0,
        lastAccessed: new Date().toISOString(),
        achievements: [],
        codeSubmissions: [],
        mistakes: []
      }
    }
    
    // Update progress
    progress.currentStep = Math.max(progress.currentStep, stepId)
    
    if (isCorrect && !progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId)
      progress.score += 10 // Basic scoring system
    }
    
    if (code) {
      progress.codeSubmissions.push({
        stepId,
        code,
        timestamp: new Date().toISOString(),
        isCorrect
      })
    }
    
    progress.lastAccessed = new Date().toISOString()
    
    // Save updated progress
    await redis.setex(progressKey, 30 * 24 * 60 * 60, JSON.stringify(progress))
    
    return {
      success: true,
      progress
    }
  } catch (error) {
    console.error('Error updating step completion:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
