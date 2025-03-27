'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { ToolInvocation } from 'ai'

interface QuestionConfirmationProps {
  toolInvocation: ToolInvocation
  onConfirm: (toolCallId: string, approved: boolean) => void
}

interface QuestionOption {
  value: string
  label: string
}

export function QuestionConfirmation({
  toolInvocation,
  onConfirm
}: QuestionConfirmationProps) {
  const { question, options, allowsInput, inputLabel, inputPlaceholder } =
    toolInvocation.args

  return (
    <Card className="my-4 border border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-lg">
          AI wants to ask a clarifying question
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium mb-2">{question}</p>
        {options && options.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-1">With these options:</p>
            <ul className="list-disc pl-5">
              {options.map((option: QuestionOption, i: number) => (
                <li key={i}>{option.label}</li>
              ))}
            </ul>
          </div>
        )}
        {allowsInput && (
          <p className="text-sm text-gray-500 mt-2">
            {inputLabel
              ? `With free input: ${inputLabel}`
              : 'With free text input option'}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onConfirm(toolInvocation.toolCallId, false)}
        >
          Decline
        </Button>
        <Button onClick={() => onConfirm(toolInvocation.toolCallId, true)}>
          Allow Question
        </Button>
      </CardFooter>
    </Card>
  )
}
