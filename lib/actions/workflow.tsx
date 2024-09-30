'use server'

import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Section } from '@/components/section'
import { FollowupPanel } from '@/components/followup-panel'
import { AnswerSection } from '@/components/answer-section'
import { ErrorCard } from '@/components/error-card'
import { transformToolMessages } from '@/lib/utils'
import {
  querySuggestor,
  inquire,
  researcher,
  taskManager,
  ollamaResearcher
} from '@/lib/agents'
import { createStreamableValue, createStreamableUI } from 'ai/rsc'
import { CoreMessage, generateId, ToolResultPart } from 'ai'
import { writer } from '../agents/writer'

export async function defaultWorkflow(
  uiState: {
    uiStream: ReturnType<typeof createStreamableUI>
    isCollapsed: ReturnType<typeof createStreamableValue>
    isGenerating: ReturnType<typeof createStreamableValue>
  },
  aiState: any,
  messages: CoreMessage[],
  skip: boolean
) {
  const { uiStream, isCollapsed, isGenerating } = uiState
  // Show the spinner
  uiStream.append(<Spinner />)

  let action = { object: { next: 'proceed' } }
  // If the user skips the task, we proceed to the search
  if (!skip) action = (await taskManager(messages)) ?? action

  if (action.object.next === 'inquire') {
    // Generate inquiry
    const inquiry = await inquire(uiStream, messages)
    uiStream.done()
    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(),
          role: 'assistant',
          content: `inquiry: ${inquiry?.question}`,
          type: 'inquiry'
        }
      ]
    })

    isCollapsed.done(false)
    isGenerating.done(false)
    uiStream.done()
    return
  }

  // Set the collapsed state to true
  isCollapsed.done(true)

  // Generate the answer
  let answer = ''
  let stopReason = ''
  let toolOutputs: ToolResultPart[] = []
  let errorOccurred = false

  const streamText = createStreamableValue<string>()

  // If ANTHROPIC_API_KEY is set, update the UI with the answer
  // If not, update the UI with a div
  if (process.env.ANTHROPIC_API_KEY) {
    uiStream.update(
      <AnswerSection result={streamText.value} hasHeader={false} />
    )
  } else {
    uiStream.update(<div />)
  }

  // Determine the API usage based on environment variables
  const useSpecificAPI = process.env.USE_SPECIFIC_API_FOR_WRITER === 'true'
  const useOllamaProvider = !!(
    process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
  )
  const maxMessages = useSpecificAPI ? 5 : useOllamaProvider ? 1 : 10
  // Limit the number of messages to the maximum
  messages.splice(0, Math.max(messages.length - maxMessages, 0))

  // If useSpecificAPI is enabled, only function calls will be made
  // If not using a tool, this model generates the answer
  while (
    useSpecificAPI
      ? toolOutputs.length === 0 && answer.length === 0 && !errorOccurred
      : (stopReason !== 'stop' || answer.length === 0) && !errorOccurred
  ) {
    // Search the web and generate the answer
    const { fullResponse, hasError, toolResponses, finishReason } =
      await researcher(uiStream, streamText, messages)
    stopReason = finishReason || ''
    answer = fullResponse
    toolOutputs = toolResponses
    errorOccurred = hasError

    if (toolOutputs.length > 0) {
      toolOutputs.map(output => {
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: generateId(),
              role: 'tool',
              content: JSON.stringify(output.result),
              name: output.toolName,
              type: 'tool'
            }
          ]
        })
      })
    }
  }

  // If useSpecificAPI is enabled, generate the answer using the specific model
  if (useSpecificAPI && answer.length === 0 && !errorOccurred) {
    // Modify the messages to be used by the specific model
    const modifiedMessages = transformToolMessages(messages)
    const latestMessages = modifiedMessages.slice(maxMessages * -1)
    const { response, hasError } = await writer(uiStream, latestMessages)
    answer = response
    errorOccurred = hasError
    messages.push({
      role: 'assistant',
      content: answer
    })
  }

  if (!errorOccurred) {
    const useGoogleProvider = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    const useOllamaProvider = !!(
      process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
    )
    let processedMessages = messages
    // If using Google provider, we need to modify the messages
    if (useGoogleProvider) {
      processedMessages = transformToolMessages(messages)
    }
    if (useOllamaProvider) {
      processedMessages = [{ role: 'assistant', content: answer }]
    }

    streamText.done()
    aiState.update({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(),
          role: 'assistant',
          content: answer,
          type: 'answer'
        }
      ]
    })

    // Generate related queries
    const relatedQueries = await querySuggestor(uiStream, processedMessages)
    // Add follow-up panel
    uiStream.append(
      <Section title="Follow-up">
        <FollowupPanel />
      </Section>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(),
          role: 'assistant',
          content: JSON.stringify(relatedQueries),
          type: 'related'
        },
        {
          id: generateId(),
          role: 'assistant',
          content: 'followup',
          type: 'followup'
        }
      ]
    })
  } else {
    aiState.done(aiState.get())
    streamText.done()
    uiStream.append(
      <ErrorCard
        errorMessage={answer || 'An error occurred. Please try again.'}
      />
    )
  }

  isGenerating.done(false)
  uiStream.done()
}

export const ollamaWorkflow = async (
  uiState: {
    uiStream: ReturnType<typeof createStreamableUI>
    isCollapsed: ReturnType<typeof createStreamableValue>
    isGenerating: ReturnType<typeof createStreamableValue>
  },
  aiState: any,
  messages: CoreMessage[],
  skip: boolean
) => {
  const { uiStream, isCollapsed, isGenerating } = uiState
  let action = { object: { next: 'proceed' } }
  // If the user skips the task, we proceed to the search
  if (!skip) action = (await taskManager(messages)) ?? action

  if (action.object.next === 'inquire') {
    // Generate inquiry
    const inquiry = await inquire(uiStream, messages)
    isCollapsed.done(false)
    isGenerating.done(false)
    uiStream.done()
    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(),
          role: 'assistant',
          content: `inquiry: ${inquiry?.question}`,
          type: 'inquiry'
        }
      ]
    })
    return
  }

  // Set the collapsed state to true
  isCollapsed.done(true)

  const { text, toolResults } = await ollamaResearcher(uiStream, messages)

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      ...toolResults.map((toolResult: any) => ({
        id: generateId(),
        role: 'tool',
        content: JSON.stringify(toolResult.result),
        name: toolResult.toolName,
        type: 'tool'
      })),
      {
        id: generateId(),
        role: 'assistant',
        content: text,
        type: 'answer'
      }
    ]
  })

  // Generate related queries
  const relatedQueries = await querySuggestor(uiStream, messages)
  // Add follow-up panel
  uiStream.append(
    <Section title="Follow-up">
      <FollowupPanel />
    </Section>
  )

  aiState.done({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: generateId(),
        role: 'assistant',
        content: JSON.stringify(relatedQueries),
        type: 'related'
      },
      {
        id: generateId(),
        role: 'assistant',
        content: 'followup',
        type: 'followup'
      }
    ]
  })
}

export async function workflow(
  uiState: {
    uiStream: ReturnType<typeof createStreamableUI>
    isCollapsed: ReturnType<typeof createStreamableValue>
    isGenerating: ReturnType<typeof createStreamableValue>
  },
  aiState: any,
  messages: CoreMessage[],
  skip: boolean
) {
  if (process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL) {
    return ollamaWorkflow(uiState, aiState, messages, skip)
  }

  return defaultWorkflow(uiState, aiState, messages, skip)
}
