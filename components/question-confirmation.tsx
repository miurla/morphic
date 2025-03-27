'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ToolInvocation } from 'ai'
import { ArrowRight, Check, FastForward } from 'lucide-react'
import { useState } from 'react'

interface QuestionConfirmationProps {
  toolInvocation: ToolInvocation
  onConfirm: (toolCallId: string, approved: boolean, response?: any) => void
  pending?: boolean
}

interface QuestionOption {
  value: string
  label: string
}

export function QuestionConfirmation({
  toolInvocation,
  onConfirm,
  pending = false
}: QuestionConfirmationProps) {
  const { question, options, allowsInput, inputLabel, inputPlaceholder } =
    toolInvocation.args

  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [inputText, setInputText] = useState('')
  const [completed, setCompleted] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const isButtonDisabled =
    (selectedOptions.length === 0 &&
      (!allowsInput || inputText.trim() === '')) ||
    pending ||
    isGenerating

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
    onConfirm(toolInvocation.toolCallId, false, { skipped: true })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    const response = {
      selectedOptions,
      inputText: inputText.trim(),
      question
    }

    onConfirm(toolInvocation.toolCallId, true, response)
    setCompleted(true)
  }

  const updatedQuery = () => {
    const optionsText =
      selectedOptions.length > 0
        ? `Selected: ${selectedOptions.join(', ')}`
        : ''

    const inputTextDisplay =
      inputText.trim() !== '' ? `Input: ${inputText}` : ''

    return [optionsText, inputTextDisplay].filter(Boolean).join(' | ')
  }

  if (completed) {
    return (
      <Card className="p-3 md:p-4 w-full flex justify-between items-center">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <h5 className="text-muted-foreground text-xs truncate">
            {updatedQuery()}
          </h5>
        </div>
        <Check size={16} className="text-green-500 w-4 h-4" />
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
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={pending || isGenerating}
            >
              <FastForward size={16} className="mr-1" />
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
