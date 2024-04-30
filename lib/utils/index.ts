import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { AIMessage } from '../types'
import { ExperimentalMessage } from 'ai'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertToExperimentalMessages(
  messages: AIMessage[]
): ExperimentalMessage[] {
  return messages
    .filter(
      message =>
        message.role === 'tool' ||
        message.role === 'assistant' ||
        message.role === 'user'
    )
    .map(message => {
      return {
        content: message.content,
        role: message.role
      } as ExperimentalMessage
    })
}
