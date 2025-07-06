import { LessonProgress, LessonState } from '@/lib/education/lesson-state'
import { Lesson } from '@/lib/education/schema'

export interface LearningProfile {
  userId: string
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
  preferredPace: 'slow' | 'medium' | 'fast'
  difficultyPreference: 'easy' | 'medium' | 'hard'
  strugglingConcepts: string[]
  masteredConcepts: string[]
  adaptations: {
    moreExplanations: boolean
    visualAids: boolean
    practiceExercises: boolean
    stepByStep: boolean
  }
}

export interface AdaptiveResponse {
  nextAction: string
  explanation: string
  adaptations: string[]
  hintsToProvide: string[]
  difficultyAdjustment: 'easier' | 'same' | 'harder'
  recommendedExercises: string[]
}

export class AdaptiveLearningEngine {
  /**
   * Analyze user progress and adapt learning approach
   */
  static analyzeProgress(progress: LessonProgress, lesson: Lesson): AdaptiveResponse {
    const analysis = {
      accuracy: this.calculateAccuracy(progress),
      speed: this.calculateSpeed(progress, lesson),
      strugglingAreas: this.identifyStrugglingAreas(progress, lesson),
      learningPattern: this.identifyLearningPattern(progress)
    }

    return this.generateAdaptiveResponse(analysis, progress, lesson)
  }

  /**
   * Calculate user's accuracy rate
   */
  private static calculateAccuracy(progress: LessonProgress): number {
    const totalSubmissions = progress.codeSubmissions.length
    if (totalSubmissions === 0) return 100

    const correctSubmissions = progress.codeSubmissions.filter(s => s.isCorrect).length
    return (correctSubmissions / totalSubmissions) * 100
  }

  /**
   * Calculate learning speed
   */
  private static calculateSpeed(progress: LessonProgress, lesson: Lesson): 'slow' | 'medium' | 'fast' {
    const completedSteps = progress.completedSteps.length
    const timeSpent = progress.timeSpent / 60 // Convert to minutes
    
    if (completedSteps === 0) return 'medium'
    
    const avgTimePerStep = timeSpent / completedSteps
    const expectedTimePerStep = lesson.estimatedDuration / lesson.steps.length
    
    if (avgTimePerStep > expectedTimePerStep * 1.5) return 'slow'
    if (avgTimePerStep < expectedTimePerStep * 0.7) return 'fast'
    return 'medium'
  }

  /**
   * Identify areas where user is struggling
   */
  private static identifyStrugglingAreas(progress: LessonProgress, lesson: Lesson): string[] {
    const strugglingAreas: string[] = []
    
    // Check for repeated mistakes on same steps
    const mistakesByStep = new Map<number, number>()
    progress.mistakes.forEach(mistake => {
      const count = mistakesByStep.get(mistake.stepId) || 0
      mistakesByStep.set(mistake.stepId, count + 1)
    })
    
    mistakesByStep.forEach((count, stepId) => {
      if (count >= 3) {
        const step = lesson.steps[stepId]
        if (step && step.concept) {
          strugglingAreas.push(step.concept)
        }
      }
    })
    
    // Check for steps with low accuracy
    const submissionsByStep = new Map<number, { total: number, correct: number }>()
    progress.codeSubmissions.forEach(submission => {
      const stats = submissionsByStep.get(submission.stepId) || { total: 0, correct: 0 }
      stats.total++
      if (submission.isCorrect) stats.correct++
      submissionsByStep.set(submission.stepId, stats)
    })
    
    submissionsByStep.forEach((stats, stepId) => {
      const accuracy = stats.correct / stats.total
      if (accuracy < 0.5 && stats.total >= 3) {
        const step = lesson.steps[stepId]
        if (step && step.concept) {
          strugglingAreas.push(step.concept)
        }
      }
    })
    
    return Array.from(new Set(strugglingAreas))
  }

  /**
   * Identify learning patterns
   */
  private static identifyLearningPattern(progress: LessonProgress): {
    needsMoreExplanations: boolean
    needsMorePractice: boolean
    needsVisualAids: boolean
    prefersStepByStep: boolean
  } {
    const recentMistakes = progress.mistakes.filter(m => {
      const mistakeTime = new Date(m.timestamp)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      return mistakeTime > hourAgo
    })
    
    const recentSubmissions = progress.codeSubmissions.filter(s => {
      const submissionTime = new Date(s.timestamp)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      return submissionTime > hourAgo
    })
    
    return {
      needsMoreExplanations: recentMistakes.length > 2,
      needsMorePractice: recentSubmissions.length > 5 && recentSubmissions.filter(s => s.isCorrect).length / recentSubmissions.length < 0.7,
      needsVisualAids: recentMistakes.some(m => m.error.includes('syntax') || m.error.includes('structure')),
      prefersStepByStep: progress.completedSteps.length > 0 && progress.currentStep === Math.max(...progress.completedSteps) + 1
    }
  }

  /**
   * Generate adaptive response based on analysis
   */
  private static generateAdaptiveResponse(
    analysis: any,
    progress: LessonProgress,
    lesson: Lesson
  ): AdaptiveResponse {
    const adaptations: string[] = []
    const hintsToProvide: string[] = []
    const recommendedExercises: string[] = []
    
    // Accuracy-based adaptations
    if (analysis.accuracy < 50) {
      adaptations.push('Provide more detailed explanations')
      adaptations.push('Break down complex concepts into smaller steps')
      hintsToProvide.push('Take your time and review the instructions carefully')
    } else if (analysis.accuracy > 90) {
      adaptations.push('Increase complexity and introduce advanced concepts')
      recommendedExercises.push('Try additional challenge exercises')
    }
    
    // Speed-based adaptations
    if (analysis.speed === 'slow') {
      adaptations.push('Provide more scaffolding and support')
      hintsToProvide.push('Don\'t worry about speed, focus on understanding')
    } else if (analysis.speed === 'fast') {
      adaptations.push('Introduce more challenging variations')
      recommendedExercises.push('Try advanced exercises to stay engaged')
    }
    
    // Struggling areas adaptations
    if (analysis.strugglingAreas.length > 0) {
      adaptations.push(`Focus on reinforcing: ${analysis.strugglingAreas.join(', ')}`)
      hintsToProvide.push(`Let's revisit the concepts of: ${analysis.strugglingAreas.join(', ')}`)
    }
    
    // Learning pattern adaptations
    if (analysis.learningPattern.needsMoreExplanations) {
      adaptations.push('Provide more detailed explanations and context')
    }
    
    if (analysis.learningPattern.needsVisualAids) {
      adaptations.push('Use more visual aids and code highlighting')
    }
    
    if (analysis.learningPattern.needsMorePractice) {
      adaptations.push('Offer additional practice exercises')
      recommendedExercises.push('Extra practice problems for reinforcement')
    }
    
    // Determine difficulty adjustment
    let difficultyAdjustment: 'easier' | 'same' | 'harder' = 'same'
    if (analysis.accuracy < 40 || analysis.speed === 'slow') {
      difficultyAdjustment = 'easier'
    } else if (analysis.accuracy > 85 && analysis.speed === 'fast') {
      difficultyAdjustment = 'harder'
    }
    
    // Generate next action
    const nextAction = this.generateNextAction(progress, lesson, analysis)
    const explanation = this.generateExplanation(analysis, adaptations)
    
    return {
      nextAction,
      explanation,
      adaptations,
      hintsToProvide,
      difficultyAdjustment,
      recommendedExercises
    }
  }

  /**
   * Generate next recommended action
   */
  private static generateNextAction(progress: LessonProgress, lesson: Lesson, analysis: any): string {
    const currentStep = progress.currentStep
    const isCurrentStepComplete = progress.completedSteps.includes(currentStep)
    
    if (!isCurrentStepComplete) {
      if (analysis.strugglingAreas.length > 0) {
        return `Review the concept of ${analysis.strugglingAreas[0]} and try step ${currentStep + 1} again`
      }
      return `Continue with step ${currentStep + 1}`
    }
    
    if (currentStep < lesson.steps.length - 1) {
      if (analysis.accuracy > 85 && analysis.speed === 'fast') {
        return `Great job! You're ready for step ${currentStep + 2}`
      }
      return `Move to step ${currentStep + 2} when you're ready`
    }
    
    return 'Congratulations! You\'ve completed this lesson'
  }

  /**
   * Generate explanation for adaptations
   */
  private static generateExplanation(analysis: any, adaptations: string[]): string {
    let explanation = `Based on your learning progress (${analysis.accuracy.toFixed(1)}% accuracy, ${analysis.speed} pace)`
    
    if (adaptations.length > 0) {
      explanation += `, I'm adapting the lesson to: ${adaptations.slice(0, 2).join(' and ')}`
    }
    
    if (analysis.strugglingAreas.length > 0) {
      explanation += `. I notice you might need extra support with: ${analysis.strugglingAreas.join(', ')}`
    }
    
    return explanation
  }

  /**
   * Generate personalized learning recommendations
   */
  static generateRecommendations(progress: LessonProgress, lesson: Lesson): string[] {
    const recommendations: string[] = []
    const adaptiveResponse = this.analyzeProgress(progress, lesson)
    
    // Study recommendations
    if (adaptiveResponse.difficultyAdjustment === 'easier') {
      recommendations.push('Consider reviewing prerequisite concepts')
      recommendations.push('Try working through examples step by step')
    } else if (adaptiveResponse.difficultyAdjustment === 'harder') {
      recommendations.push('You\'re ready for more advanced topics')
      recommendations.push('Consider exploring related concepts independently')
    }
    
    // Practice recommendations
    if (adaptiveResponse.recommendedExercises.length > 0) {
      recommendations.push(...adaptiveResponse.recommendedExercises)
    }
    
    // Learning style recommendations
    const accuracy = this.calculateAccuracy(progress)
    if (accuracy < 60) {
      recommendations.push('Try explaining concepts out loud to reinforce understanding')
      recommendations.push('Use visual aids and diagrams when possible')
    }
    
    return recommendations
  }
}

// Helper function to create adaptive learning suggestions
export const generateAdaptiveSuggestions = (progress: LessonProgress, lesson: Lesson): string[] => {
  const adaptiveResponse = AdaptiveLearningEngine.analyzeProgress(progress, lesson)
  return [
    ...adaptiveResponse.hintsToProvide,
    ...adaptiveResponse.adaptations,
    ...AdaptiveLearningEngine.generateRecommendations(progress, lesson)
  ]
}
