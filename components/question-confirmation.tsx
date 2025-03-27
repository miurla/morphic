'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ToolInvocation } from 'ai'
import { ArrowRight, Check, SkipForward } from 'lucide-react'
import { useState } from 'react'

interface QuestionConfirmationProps {
  toolInvocation: ToolInvocation
  onConfirm: (toolCallId: string, approved: boolean, response?: any) => void
  isCompleted?: boolean
}

interface QuestionOption {
  value: string
  label: string
}

export function QuestionConfirmation({
  toolInvocation,
  onConfirm,
  isCompleted = false
}: QuestionConfirmationProps) {
  const { question, options, allowsInput, inputLabel, inputPlaceholder } =
    toolInvocation.args

  // Get result data if available
  const resultData =
    toolInvocation.state === 'result' && toolInvocation.result
      ? toolInvocation.result
      : null

  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [inputText, setInputText] = useState('')
  const [completed, setCompleted] = useState(isCompleted)
  const [skipped, setSkipped] = useState(false)

  const isButtonDisabled =
    selectedOptions.length === 0 && (!allowsInput || inputText.trim() === '')

  const handleOptionChange = (label: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(label)) {
        return prev.filter(item => item !== label)
      } else {
        return [...prev, label]
      }
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
  }

  const handleSkip = () => {
    setSkipped(true)
    setCompleted(true)
    onConfirm(toolInvocation.toolCallId, false, { skipped: true })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const response = {
      selectedOptions,
      inputText: inputText.trim(),
      question
    }

    onConfirm(toolInvocation.toolCallId, true, response)
    setCompleted(true)
  }

  // Get options to display (from result or local state)
  const getDisplayedOptions = (): string[] => {
    if (resultData && Array.isArray(resultData.selectedOptions)) {
      return resultData.selectedOptions
    }
    return selectedOptions
  }

  // Get input text to display (from result or local state)
  const getDisplayedInputText = (): string => {
    if (resultData && resultData.inputText) {
      return resultData.inputText
    }
    return inputText
  }

  // Check if question was skipped
  const wasSkipped = (): boolean => {
    if (resultData && resultData.skipped) {
      return true
    }
    return skipped
  }

  const updatedQuery = () => {
    // If skipped, show skipped message
    if (wasSkipped()) {
      return 'Question skipped'
    }

    const displayOptions = getDisplayedOptions()
    const displayInputText = getDisplayedInputText()

    const optionsText =
      displayOptions.length > 0 ? `Selected: ${displayOptions.join(', ')}` : ''

    const inputTextDisplay =
      displayInputText.trim() !== '' ? `Input: ${displayInputText}` : ''

    return [optionsText, inputTextDisplay].filter(Boolean).join(' | ')
  }

  // Show result view if completed or if tool has result state
  if (completed || toolInvocation.state === 'result') {
    const isSkipped = wasSkipped()

    return (
      <Card className="p-3 md:p-4 w-full flex flex-col justify-between items-center gap-2">
        <CardTitle className="text-base font-medium text-muted-foreground w-full">
          {question}
        </CardTitle>
        <div className="flex items-center justify-start gap-1 w-full">
          {isSkipped ? (
            <SkipForward size={16} className="text-yellow-500 w-4 h-4" />
          ) : (
            <Check size={16} className="text-green-500 w-4 h-4" />
          )}
          <h5 className="text-muted-foreground text-xs truncate">
            {updatedQuery()}
          </h5>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{question}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap justify-start mb-4">
            {options &&
              options.map((option: QuestionOption, index: number) => (
                <div
                  key={`option-${index}`}
                  className="flex items-center space-x-1.5 mb-2"
                >
                  <Checkbox
                    id={option.value}
                    checked={selectedOptions.includes(option.label)}
                    onCheckedChange={() => handleOptionChange(option.label)}
                  />
                  <label
                    className="text-sm whitespace-nowrap pr-4"
                    htmlFor={option.value}
                  >
                    {option.label}
                  </label>
                </div>
              ))}
          </div>

          {allowsInput && (
            <div className="mb-6 flex flex-col space-y-2 text-sm">
              <label className="text-muted-foreground" htmlFor="query">
                {inputLabel}
              </label>
              <Input
                type="text"
                name="additional_query"
                className="w-full"
                id="query"
                placeholder={inputPlaceholder}
                value={inputText}
                onChange={handleInputChange}
              />
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleSkip}>
              <SkipForward size={16} className="mr-1" />
              Skip
            </Button>
            <Button type="submit" disabled={isButtonDisabled}>
              <ArrowRight size={16} className="mr-1" />
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
