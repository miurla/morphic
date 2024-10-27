'use server'

import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Section } from '@/components/section'
import { FollowupPanel } from '@/components/followup-panel'
import {
  querySuggestor,
  inquire,
  taskManager,
  researcherWithOllama,
  researcher
} from '@/lib/agents'
import { createStreamableValue, createStreamableUI } from 'ai/rsc'
import { CoreMessage, generateId } from 'ai'

export async function workflow(
  uiState: {
    uiStream: ReturnType<typeof createStreamableUI>
    isCollapsed: ReturnType<typeof createStreamableValue>
    isGenerating: ReturnType<typeof createStreamableValue>
  },
  aiState: any,
  messages: CoreMessage[],
  skip: boolean,
  model: string
) {
  const { uiStream, isCollapsed, isGenerating } = uiState
  const id = generateId()

  // Display spinner
  uiStream.append(<Spinner />)

  let action = { object: { next: 'proceed' } }
  // If the user does not skip the task, run the task manager
  if (!skip) action = (await taskManager(messages, model)) ?? action

  if (action.object.next === 'inquire') {
    // Generate inquiry
    const inquiry = await inquire(uiStream, messages, model)
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
    return
  }

  // Set the collapsed state to true
  isCollapsed.done(true)

  // Remove the spinner
  uiStream.update(null)

  const useOllama = model.startsWith('ollama')
  // Select the appropriate researcher function based on the environment variables
  const { text, toolResults } = useOllama
    ? await researcherWithOllama(uiStream, messages, model)
    : await researcher(uiStream, messages, model)

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      ...toolResults.map((toolResult: any) => ({
        id,
        role: 'tool',
        content: JSON.stringify(toolResult.result),
        name: toolResult.toolName,
        type: 'tool'
      })),
      {
        id,
        role: 'assistant',
        content: text,
        type: 'answer'
      }
    ]
  })

  const messagesWithAnswer: CoreMessage[] = [
    ...messages,
    {
      role: 'assistant',
      content: text
    }
  ]

  // Generate related queries
  const relatedQueries = await querySuggestor(
    uiStream,
    messagesWithAnswer,
    model
  )
  // Add follow-up panel
  uiStream.append(
    <Section title="Follow-up">
      <FollowupPanel />
    </Section>
  )

  uiStream.done()
  isGenerating.done(false)

  aiState.done({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id,
        role: 'assistant',
        content: JSON.stringify(relatedQueries),
        type: 'related'
      },
      {
        id,
        role: 'assistant',
        content: 'followup',
        type: 'followup'
      }
    ]
  })
}
