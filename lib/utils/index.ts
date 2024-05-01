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

  // Get the tool call message
  const toolCallMessage = messages.slice(lastUserMessageIndex).find(message => {
    return (
      message.role === 'assistant' &&
      Array.isArray(message.content) &&
      message.content.find(content => content.type == 'tool-call')
    )
  })

  // Extract the tool call message content
  const toolCallContent = Array.isArray(toolCallMessage?.content)
    ? (toolCallMessage.content.find(
        content => content.type == 'tool-call'
      ) as ToolCallPart)
    : null

  // Construct the properly formatted tool call message
  const formattedToolCallMessage: ExperimentalAssistantMessage | null =
    toolCallContent
      ? {
          role: 'assistant',
          content: [toolCallContent]
        }
      : null

  // Get the tool response message
  const toolResponseMessage = messages
    .slice(lastUserMessageIndex)
    .find(message => message.role === 'tool')

  // Extract the tool response message content
  const toolResponseContent = Array.isArray(toolResponseMessage?.content)
    ? (toolResponseMessage.content[0] as ToolResultPart)
    : null

  // Construct the properly formatted tool response message
  const formattedToolResponseMessage: ExperimentalToolMessage | null =
    toolResponseContent
      ? {
          role: 'tool',
          content: [
            {
              toolCallId: toolResponseContent.toolCallId,
              type: 'tool-result',
              toolName: toolResponseContent.toolName,
              result: [toolResponseContent.result]
            }
          ]
        }
      : null

  // Both tool call and tool response messages must be exsist because
  // the OpenAI api expects both
  if (!formattedToolCallMessage || !formattedToolResponseMessage) {
    return []
  }

  return [formattedToolCallMessage, formattedToolResponseMessage]
}
