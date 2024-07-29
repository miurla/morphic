import {
  StreamableValue,
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState
} from 'ai/rsc'
import { CoreMessage, generateId, ToolResultPart } from 'ai'
import { Spinner } from '@/components/ui/spinner'
import { Section } from '@/components/section'
import { FollowupPanel } from '@/components/followup-panel'
import { inquire, researcher, taskManager, querySuggestor } from '@/lib/agents'
import { writer } from '@/lib/agents/writer'
import { saveChat } from '@/lib/actions/chat'
import { Chat } from '@/lib/types'
import { AIMessage } from '@/lib/types'
import { UserMessage } from '@/components/user-message'
import { SearchSection } from '@/components/search-section'
import SearchRelated from '@/components/search-related'
import { CopilotDisplay } from '@/components/copilot-display'
import RetrieveSection from '@/components/retrieve-section'
import { VideoSearchSection } from '@/components/video-search-section'
import { transformToolMessages } from '@/lib/utils'
import { AnswerSection } from '@/components/answer-section'
import { ErrorCard } from '@/components/error-card'

async function submit(
  formData?: FormData,
  skip?: boolean,
  retryMessages?: AIMessage[]
) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()
  const uiStream = createStreamableUI()
  const isGenerating = createStreamableValue(true)
  const isCollapsed = createStreamableValue(false)

  const aiMessages = [...(retryMessages ?? aiState.get().messages)]
  // Get the messages from the state, filter out the tool messages
  const messages: CoreMessage[] = aiMessages
    .filter(
      message =>
        message.role !== 'tool' &&
        message.type !== 'followup' &&
        message.type !== 'related' &&
        message.type !== 'end'
    )
    .map(message => {
      const { role, content } = message
      return { role, content } as CoreMessage
    })

  // groupId is used to group the messages for collapse
  const groupId = generateId()

  const useSpecificAPI = process.env.USE_SPECIFIC_API_FOR_WRITER === 'true'
  const useOllamaProvider = !!(
    process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
  )
  const maxMessages = useSpecificAPI ? 5 : useOllamaProvider ? 1 : 10
  // Limit the number of messages to the maximum
  messages.splice(0, Math.max(messages.length - maxMessages, 0))
  // Get the user input from the form data
  const userInput = skip
    ? `{"action": "skip"}`
    : (formData?.get('input') as string)

  const content = skip
    ? userInput
    : formData
    ? JSON.stringify(Object.fromEntries(formData))
    : null
  const type = skip
    ? undefined
    : formData?.has('input')
    ? 'input'
    : formData?.has('related_query')
    ? 'input_related'
    : 'inquiry'

  // Add the user message to the state
  if (content) {
    aiState.update({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(),
          role: 'user',
          content,
          type
        }
      ]
    })
    messages.push({
      role: 'user',
      content
    })
  }

  async function processEvents() {
    // Show the spinner
    uiStream.append(<Spinner />)

    let action = { object: { next: 'proceed' } }
    // If the user skips the task, we proceed to the search
    if (!skip) action = (await taskManager(messages)) ?? action

    if (action.object.next === 'inquire') {
      // Generate inquiry
      const inquiry = await inquire(uiStream, messages)
      uiStream.done()
      isGenerating.done()
      isCollapsed.done(false)
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

    //  Generate the answer
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
                id: groupId,
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
      // modify the messages to be used by the specific model
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
            id: groupId,
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
            id: groupId,
            role: 'assistant',
            content: JSON.stringify(relatedQueries),
            type: 'related'
          },
          {
            id: groupId,
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

  processEvents()

  return {
    id: generateId(),
    isGenerating: isGenerating.value,
    component: uiStream.value,
    isCollapsed: isCollapsed.value
  }
}

export type AIState = {
  messages: AIMessage[]
  chatId: string
  isSharePage?: boolean
}

export type UIState = {
  id: string
  component: React.ReactNode
  isGenerating?: StreamableValue<boolean>
  isCollapsed?: StreamableValue<boolean>
}[]

const initialAIState: AIState = {
  chatId: generateId(),
  messages: []
}

const initialUIState: UIState = []

// AI is a provider you wrap your application with so you can access AI and UI state in your components.
export const AI = createAI<AIState, UIState>({
  actions: {
    submit
  },
  initialUIState,
  initialAIState,
  onGetUIState: async () => {
    'use server'

    const aiState = getAIState()
    if (aiState) {
      const uiState = getUIStateFromAIState(aiState as Chat)
      return uiState
    } else {
      return
    }
  },
  onSetAIState: async ({ state, done }) => {
    'use server'

    // Check if there is any message of type 'answer' in the state messages
    if (!state.messages.some(e => e.type === 'answer')) {
      return
    }

    const { chatId, messages } = state
    const createdAt = new Date()
    const userId = 'anonymous'
    const path = `/search/${chatId}`
    const title =
      messages.length > 0
        ? JSON.parse(messages[0].content)?.input?.substring(0, 100) ||
          'Untitled'
        : 'Untitled'
    // Add an 'end' message at the end to determine if the history needs to be reloaded
    const updatedMessages: AIMessage[] = [
      ...messages,
      {
        id: generateId(),
        role: 'assistant',
        content: `end`,
        type: 'end'
      }
    ]

    const chat: Chat = {
      id: chatId,
      createdAt,
      userId,
      path,
      title,
      messages: updatedMessages
    }
    await saveChat(chat)
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  const chatId = aiState.chatId
  const isSharePage = aiState.isSharePage
  return aiState.messages
    .map((message, index) => {
      const { role, content, id, type, name } = message

      if (
        !type ||
        type === 'end' ||
        (isSharePage && type === 'related') ||
        (isSharePage && type === 'followup')
      )
        return null

      switch (role) {
        case 'user':
          switch (type) {
            case 'input':
            case 'input_related':
              const json = JSON.parse(content)
              const value = type === 'input' ? json.input : json.related_query
              return {
                id,
                component: (
                  <UserMessage
                    message={value}
                    chatId={chatId}
                    showShare={index === 0 && !isSharePage}
                  />
                )
              }
            case 'inquiry':
              return {
                id,
                component: <CopilotDisplay content={content} />
              }
          }
        case 'assistant':
          const answer = createStreamableValue()
          answer.done(content)
          switch (type) {
            case 'answer':
              return {
                id,
                component: <AnswerSection result={answer.value} />
              }
            case 'related':
              const relatedQueries = createStreamableValue()
              relatedQueries.done(JSON.parse(content))
              return {
                id,
                component: (
                  <SearchRelated relatedQueries={relatedQueries.value} />
                )
              }
            case 'followup':
              return {
                id,
                component: (
                  <Section title="Follow-up" className="pb-8">
                    <FollowupPanel />
                  </Section>
                )
              }
          }
        case 'tool':
          try {
            const toolOutput = JSON.parse(content)
            const isCollapsed = createStreamableValue()
            isCollapsed.done(true)
            const searchResults = createStreamableValue()
            searchResults.done(JSON.stringify(toolOutput))
            switch (name) {
              case 'search':
                return {
                  id,
                  component: <SearchSection result={searchResults.value} />,
                  isCollapsed: isCollapsed.value
                }
              case 'retrieve':
                return {
                  id,
                  component: <RetrieveSection data={toolOutput} />,
                  isCollapsed: isCollapsed.value
                }
              case 'videoSearch':
                return {
                  id,
                  component: (
                    <VideoSearchSection result={searchResults.value} />
                  ),
                  isCollapsed: isCollapsed.value
                }
            }
          } catch (error) {
            return {
              id,
              component: null
            }
          }
        default:
          return {
            id,
            component: null
          }
      }
    })
    .filter(message => message !== null) as UIState
}
