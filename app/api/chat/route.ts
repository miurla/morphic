import { getChat, saveChat } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { researcher } from '@/lib/agents/researcher'
import { ExtendedCoreMessage } from '@/lib/types'
import { convertToExtendedCoreMessages } from '@/lib/utils'
import { isProviderEnabled } from '@/lib/utils/registry'
import {
  convertToCoreMessages,
  createDataStreamResponse,
  JSONValue,
  streamText
} from 'ai'
import { cookies } from 'next/headers'

export const maxDuration = 30

const DEFAULT_MODEL = 'openai:gpt-4o-mini'

export async function POST(req: Request) {
  try {
    const { messages, id: chatId } = await req.json()
    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    const coreMessages = convertToCoreMessages(messages)
    const extendedCoreMessages = convertToExtendedCoreMessages(messages)

    const cookieStore = await cookies()
    const modelFromCookie = cookieStore.get('selected-model')?.value
    const model = modelFromCookie || DEFAULT_MODEL
    const provider = model.split(':')[0]

    if (!isProviderEnabled(provider)) {
      return new Response(`Selected provider is not enabled ${provider}`, {
        status: 404,
        statusText: 'Not Found'
      })
    }

    return createDataStreamResponse({
      execute: async dataStream => {
        try {
          let researcherConfig
          try {
            researcherConfig = await researcher({
              messages: coreMessages,
              model
            })
          } catch (error) {
            console.error('Researcher configuration error:', error)
            throw new Error('Failed to initialize researcher configuration')
          }

          const result = streamText({
            ...researcherConfig,
            onFinish: async event => {
              try {
                const responseMessages = event.response.messages

                let annotation: JSONValue = {
                  type: 'related-questions',
                  data: {
                    items: []
                  }
                }

                // Notify related questions loading
                dataStream.writeMessageAnnotation(annotation)

                // Generate related questions
                const relatedQuestions = await generateRelatedQuestions(
                  responseMessages,
                  model
                )

                // Update the annotation with the related questions
                annotation = {
                  ...annotation,
                  data: relatedQuestions.object
                }

                // Send related questions to client
                dataStream.writeMessageAnnotation(annotation)

                // Create the message to save
                const generatedMessages = [
                  ...extendedCoreMessages,
                  ...responseMessages.slice(0, -1),
                  {
                    role: 'data',
                    content: annotation
                  },
                  responseMessages[responseMessages.length - 1]
                ] as ExtendedCoreMessage[]

                // Get the chat from the database if it exists, otherwise create a new one
                const savedChat = (await getChat(chatId)) ?? {
                  messages: [],
                  createdAt: new Date(),
                  userId: 'anonymous',
                  path: `/search/${chatId}`,
                  title: messages[0].content,
                  id: chatId
                }

                // Save chat with complete response and related questions
                await saveChat({
                  ...savedChat,
                  messages: generatedMessages
                }).catch(error => {
                  console.error('Failed to save chat:', error)
                  throw new Error('Failed to save chat history')
                })
              } catch (error) {
                console.error('Error in onFinish:', error)
                throw error
              }
            }
          })

          result.mergeIntoDataStream(dataStream)
        } catch (error) {
          console.error('Stream execution error:', error)
        }
      },
      onError: error => {
        console.error('Stream error:', error)
        return error instanceof Error ? error.message : String(error)
      }
    })
  } catch (error) {
    console.error('API route error:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        status: 500
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
