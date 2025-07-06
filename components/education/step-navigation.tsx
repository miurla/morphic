'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Circle, 
  Play, 
  Pause,
  RotateCcw,
  Trophy,
  Clock,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step {
  id: number
  title: string
  description: string
  isComplete: boolean
  isCurrent: boolean
  isAccessible: boolean
  concept?: string
  estimatedTime?: number
}

export interface StepNavigationProps {
  steps: Step[]
  currentStep: number
  totalSteps: number
  onStepChange: (stepId: number) => void
  onPrevious: () => void
  onNext: () => void
  onReset: () => void
  canProceed: boolean
  isPlaying?: boolean
  onPlayPause?: () => void
  progress?: {
    completedSteps: number
    accuracy: number
    timeSpent: number
    achievements: string[]
  }
  className?: string
}

export function StepNavigation({
  steps,
  currentStep,
  totalSteps,
  onStepChange,
  onPrevious,
  onNext,
  onReset,
  canProceed,
  isPlaying = false,
  onPlayPause,
  progress,
  className
}: StepNavigationProps) {
  const [showProgress, setShowProgress] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  const completionPercentage = Math.round((progress?.completedSteps || 0) / totalSteps * 100)
  const currentStepData = steps.find(step => step.id === currentStep)

  useEffect(() => {
    // Auto-compact on smaller screens
    const handleResize = () => {
      setCompactMode(window.innerWidth < 768)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getStepIcon = (step: Step) => {
    if (step.isComplete) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    if (step.isCurrent) {
      return <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />
    }
    return <Circle className="w-4 h-4 text-gray-400" />
  }

  return (
    <Card className={cn("w-full border-0 shadow-sm", className)}>
      <CardContent className="p-4">
        {/* Header with Progress */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-sm font-medium">
              Step {currentStep + 1} of {totalSteps}
            </div>
            {progress && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Target className="w-4 h-4" />
                <span>{progress.accuracy.toFixed(0)}% accuracy</span>
                <Clock className="w-4 h-4 ml-2" />
                <span>{formatTime(progress.timeSpent / 60)}</span>
                {progress.achievements.length > 0 && (
                  <>
                    <Trophy className="w-4 h-4 ml-2 text-yellow-500" />
                    <span>{progress.achievements.length}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {onPlayPause && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPlayPause}
                className="h-8 w-8 p-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 w-8 p-0"
              title="Reset Progress"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <Progress value={completionPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{completionPercentage}% Complete</span>
            <span>{progress?.completedSteps || 0}/{totalSteps} Steps</span>
          </div>
        </div>

        {/* Current Step Info */}
        {currentStepData && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="mt-1">
                <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-1">
                  {currentStepData.title}
                </h4>
                <p className="text-sm text-blue-700 mb-2">
                  {currentStepData.description}
                </p>
                <div className="flex items-center space-x-4 text-xs text-blue-600">
                  {currentStepData.concept && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {currentStepData.concept}
                    </Badge>
                  )}
                  {currentStepData.estimatedTime && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{currentStepData.estimatedTime}min</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step List */}
        {!compactMode && (
          <div className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => step.isAccessible && onStepChange(step.id)}
                  disabled={!step.isAccessible}
                  className={cn(
                    "flex items-center space-x-2 p-2 rounded-lg border transition-colors text-left",
                    step.isCurrent && "bg-blue-50 border-blue-200",
                    step.isComplete && "bg-green-50 border-green-200",
                    !step.isAccessible && "opacity-50 cursor-not-allowed",
                    step.isAccessible && !step.isCurrent && !step.isComplete && "hover:bg-gray-50"
                  )}
                >
                  {getStepIcon(step)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      Step {step.id + 1}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compact Step Indicators */}
        {compactMode && (
          <div className="mb-4">
            <div className="flex items-center space-x-1 overflow-x-auto py-2">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => step.isAccessible && onStepChange(step.id)}
                  disabled={!step.isAccessible}
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs",
                    step.isCurrent && "bg-blue-500 border-blue-500 text-white",
                    step.isComplete && "bg-green-500 border-green-500 text-white",
                    !step.isAccessible && "opacity-50 cursor-not-allowed",
                    step.isAccessible && !step.isCurrent && !step.isComplete && "border-gray-300 hover:border-gray-400"
                  )}
                  title={step.title}
                >
                  {step.isComplete ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    step.id + 1
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProgress(!showProgress)}
              className="px-3"
            >
              {showProgress ? 'Hide' : 'Show'} Progress
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompactMode(!compactMode)}
              className="px-3"
            >
              {compactMode ? 'Expand' : 'Compact'}
            </Button>
          </div>

          <Button
            onClick={onNext}
            disabled={!canProceed || currentStep >= totalSteps - 1}
            className="flex items-center space-x-2"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Achievement Badges */}
        {progress && progress.achievements.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium mb-2">Achievements</div>
            <div className="flex flex-wrap gap-2">
              {progress.achievements.map((achievement, index) => (
                <Badge key={index} variant="secondary" className="bg-yellow-100 text-yellow-800">
                  <Trophy className="w-3 h-3 mr-1" />
                  {achievement.replace('_', ' ').toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default StepNavigation
