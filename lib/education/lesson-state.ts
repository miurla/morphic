import { redis } from '@/lib/redis'
import { Lesson, LessonProgress, LessonSchema, ProgressSchema } from '@/lib/education/schema'
import { loadLesson } from '@/lib/education/content-loader'

export type { LessonProgress } from '@/lib/education/schema'

export interface LessonState {
  lesson: Lesson
  progress: LessonProgress
  currentStep: number
  canProceed: boolean
  isComplete: boolean
  nextAction: string
  hints: string[]
  errors: string[]
}

export class LessonStateManager {
  private userId: string
  private lessonId: string
  private stateKey: string

  constructor(userId: string, lessonId: string) {
    this.userId = userId
    this.lessonId = lessonId
    this.stateKey = `lesson_state:${userId}:${lessonId}`
  }

  /**
   * Initialize or load lesson state
   */
  async initialize(): Promise<LessonState> {
    try {
      // Load lesson content
      const lesson = await loadLesson(this.lessonId)
      if (!lesson) {
        throw new Error(`Lesson not found: ${this.lessonId}`)
      }

      // Load existing progress
      const progressKey = `progress:${this.userId}:${this.lessonId}`
      const savedProgress = await redis.get(progressKey)
      
      let progress: LessonProgress
      if (savedProgress) {
        progress = ProgressSchema.parse(JSON.parse(savedProgress))
      } else {
        // Create new progress
        progress = {
          userId: this.userId,
          lessonId: this.lessonId,
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

      const state: LessonState = {
        lesson,
        progress,
        currentStep: progress.currentStep,
        canProceed: this.canProceedToNextStep(progress, lesson),
        isComplete: progress.completedSteps.length === lesson.steps.length,
        nextAction: this.getNextAction(progress, lesson),
        hints: this.getHints(progress, lesson),
        errors: this.getErrors(progress, lesson)
      }

      // Cache the state
      await redis.setex(this.stateKey, 60 * 60, JSON.stringify(state)) // 1 hour cache
      
      return state
    } catch (error) {
      console.error('Error initializing lesson state:', error)
      throw error
    }
  }

  /**
   * Update lesson state after a step completion
   */
  async updateState(stepId: number, isCorrect: boolean, code?: string, error?: string): Promise<LessonState> {
    try {
      const state = await this.initialize()
      
      // Update progress
      state.progress.currentStep = Math.max(state.progress.currentStep, stepId)
      
      if (isCorrect && !state.progress.completedSteps.includes(stepId)) {
        state.progress.completedSteps.push(stepId)
        state.progress.score += 10
        
        // Check for achievements
        const newAchievements = this.checkAchievements(state.progress, state.lesson)
        state.progress.achievements.push(...newAchievements)
      }
      
      if (code) {
        state.progress.codeSubmissions.push({
          stepId,
          code,
          timestamp: new Date().toISOString(),
          isCorrect
        })
      }
      
      if (error) {
        state.progress.mistakes.push({
          stepId,
          error,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
      
      state.progress.lastAccessed = new Date().toISOString()
      
      // Update derived state
      state.currentStep = state.progress.currentStep
      state.canProceed = this.canProceedToNextStep(state.progress, state.lesson)
      state.isComplete = state.progress.completedSteps.length === state.lesson.steps.length
      state.nextAction = this.getNextAction(state.progress, state.lesson)
      state.hints = this.getHints(state.progress, state.lesson)
      state.errors = this.getErrors(state.progress, state.lesson)
      
      // Save progress
      const progressKey = `progress:${this.userId}:${this.lessonId}`
      await redis.setex(progressKey, 30 * 24 * 60 * 60, JSON.stringify(state.progress))
      
      // Update cached state
      await redis.setex(this.stateKey, 60 * 60, JSON.stringify(state))
      
      return state
    } catch (error) {
      console.error('Error updating lesson state:', error)
      throw error
    }
  }

  /**
   * Navigate to a specific step
   */
  async navigateToStep(stepId: number): Promise<LessonState> {
    try {
      const state = await this.initialize()
      
      // Check if user can access this step
      if (stepId > state.progress.currentStep + 1) {
        throw new Error('Cannot jump ahead without completing previous steps')
      }
      
      state.currentStep = stepId
      state.progress.currentStep = stepId
      state.progress.lastAccessed = new Date().toISOString()
      
      // Update other derived properties
      state.canProceed = this.canProceedToNextStep(state.progress, state.lesson)
      state.nextAction = this.getNextAction(state.progress, state.lesson)
      state.hints = this.getHints(state.progress, state.lesson)
      state.errors = this.getErrors(state.progress, state.lesson)
      
      // Save progress
      const progressKey = `progress:${this.userId}:${this.lessonId}`
      await redis.setex(progressKey, 30 * 24 * 60 * 60, JSON.stringify(state.progress))
      
      // Update cached state
      await redis.setex(this.stateKey, 60 * 60, JSON.stringify(state))
      
      return state
    } catch (error) {
      console.error('Error navigating to step:', error)
      throw error
    }
  }

  /**
   * Get current lesson state from cache or initialize
   */
  async getCurrentState(): Promise<LessonState> {
    try {
      const cachedState = await redis.get(this.stateKey)
      if (cachedState) {
        return JSON.parse(cachedState)
      }
      
      return await this.initialize()
    } catch (error) {
      console.error('Error getting current state:', error)
      throw error
    }
  }

  /**
   * Reset lesson progress
   */
  async resetProgress(): Promise<LessonState> {
    try {
      // Clear progress
      const progressKey = `progress:${this.userId}:${this.lessonId}`
      await redis.del(progressKey)
      
      // Clear cached state
      await redis.del(this.stateKey)
      
      // Reinitialize
      return await this.initialize()
    } catch (error) {
      console.error('Error resetting progress:', error)
      throw error
    }
  }

  /**
   * Check if user can proceed to next step
   */
  private canProceedToNextStep(progress: LessonProgress, lesson: Lesson): boolean {
    const currentStep = progress.currentStep
    const isCurrentStepComplete = progress.completedSteps.includes(currentStep)
    const hasNextStep = currentStep < lesson.steps.length - 1
    
    return isCurrentStepComplete && hasNextStep
  }

  /**
   * Get next recommended action
   */
  private getNextAction(progress: LessonProgress, lesson: Lesson): string {
    const currentStep = progress.currentStep
    const isCurrentStepComplete = progress.completedSteps.includes(currentStep)
    
    if (!isCurrentStepComplete) {
      return `Complete step ${currentStep + 1}`
    }
    
    if (currentStep < lesson.steps.length - 1) {
      return `Proceed to step ${currentStep + 2}`
    }
    
    return 'Lesson complete!'
  }

  /**
   * Get contextual hints
   */
  private getHints(progress: LessonProgress, lesson: Lesson): string[] {
    const hints: string[] = []
    const currentStep = progress.currentStep
    const step = lesson.steps[currentStep]
    
    if (!step) return hints
    
    // Check for recent mistakes
    const recentMistakes = progress.mistakes.filter(m => m.stepId === currentStep && !m.resolved)
    if (recentMistakes.length > 2) {
      hints.push('You seem to be having trouble with this step. Try reviewing the instructions carefully.')
    }
    
    // Check for multiple code submissions
    const submissions = progress.codeSubmissions.filter(s => s.stepId === currentStep)
    if (submissions.length > 3) {
      hints.push('Consider reviewing the expected output or asking for help.')
    }
    
    // Add step-specific hints if available
    if (step.hints) {
      hints.push(...step.hints)
    }
    
    return hints
  }

  /**
   * Get current errors
   */
  private getErrors(progress: LessonProgress, lesson: Lesson): string[] {
    const currentStep = progress.currentStep
    const unresolvedErrors = progress.mistakes
      .filter(m => m.stepId === currentStep && !m.resolved)
      .map(m => m.error)
    
    return unresolvedErrors
  }

  /**
   * Check for new achievements
   */
  private checkAchievements(progress: LessonProgress, lesson: Lesson): string[] {
    const newAchievements: string[] = []
    
    // First step completion
    if (progress.completedSteps.length === 1 && !progress.achievements.includes('first_step')) {
      newAchievements.push('first_step')
    }
    
    // Perfect score (no mistakes)
    if (progress.completedSteps.length === lesson.steps.length && progress.mistakes.length === 0) {
      if (!progress.achievements.includes('perfect_score')) {
        newAchievements.push('perfect_score')
      }
    }
    
    // Speed demon (completed in under 30 minutes)
    if (progress.completedSteps.length === lesson.steps.length && progress.timeSpent < 30 * 60) {
      if (!progress.achievements.includes('speed_demon')) {
        newAchievements.push('speed_demon')
      }
    }
    
    // Persistence (completed with many mistakes but kept going)
    if (progress.completedSteps.length === lesson.steps.length && progress.mistakes.length > 10) {
      if (!progress.achievements.includes('persistent')) {
        newAchievements.push('persistent')
      }
    }
    
    return newAchievements
  }
}

// Helper function to create lesson state manager
export const createLessonStateManager = (userId: string, lessonId: string): LessonStateManager => {
  return new LessonStateManager(userId, lessonId)
}
