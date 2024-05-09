import {
  ExperimentalAssistantMessage,
  ExperimentalMessage,
  ExperimentalToolMessage,
  ToolCallPart,
  ToolResultPart
} from 'ai'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tool messages must be formated in a specific way to be added to the aiState
export function formatToolMessages(messages: ExperimentalMessage[]) {
  // Get the index of latest user message so that we only format the latest tool messages
  const lastUserMessageIndex = messages.findLastIndex(
    message => message.role === 'user'
  )

  // Find the message that contains a tool call part
  const toolCallMessage = messages.slice(lastUserMessageIndex).find(message => {
    return (
      message.role === 'assistant' &&
      Array.isArray(message.content) &&
      message.content.find(content => content.type == 'tool-call')
    )
  })

  // Extract the tool call message contents
  const toolCallContents = Array.isArray(toolCallMessage?.content)
    ? (toolCallMessage.content.filter(
        content => content.type == 'tool-call'
      ) as ToolCallPart[])
    : null

  // Construct the properly formatted tool call message
  const formattedToolCallMessage: ExperimentalAssistantMessage | null =
    toolCallContents && toolCallContents.length > 0
      ? {
          role: 'assistant',
          content: toolCallContents
        }
      : null

  // Get the tool response message
  const toolResponseMessage = messages
    .slice(lastUserMessageIndex)
    .find(message => message.role === 'tool')

  // Extract the tool response message contents
  const toolResponseContents = Array.isArray(toolResponseMessage?.content)
    ? (toolResponseMessage.content as ToolResultPart[])
    : null

  // Construct the properly formatted tool response message
  const formattedToolResponseMessage: ExperimentalToolMessage | null =
    toolResponseContents && toolResponseContents.length > 0
      ? {
          role: 'tool',
          content: toolResponseContents
        }
      : null

  // Both tool call and response messages must be present for the OpenAI api to work
  if (!formattedToolCallMessage || !formattedToolResponseMessage) {
    return []
  }

  return [formattedToolCallMessage, formattedToolResponseMessage]
}
