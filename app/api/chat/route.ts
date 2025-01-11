import {
  streamText,
  createDataStreamResponse,
  convertToCoreMessages,
  JSONValue
} from 'ai'
import { researcher } from '@/lib/agents/researcher'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { cookies } from 'next/headers'
import { getChat, saveChat } from '@/lib/actions/chat'
import { ExtendedCoreMessage } from '@/lib/types'
import { convertToExtendedCoreMessages } from '@/lib/utils'

export const maxDuration = 30

const DEFAULT_MODEL = 'openai:gpt-4o-mini'

export async function POST(req: Request) {
  const { messages, id: chatId } = await req.json()
  const referer = req.headers.get('referer')
  const isSharePage = referer?.includes('/share/')

  // Note: Currently, we don't support chat API on share pages
  if (isSharePage) {
    return new Response('Chat API is not available on share pages', {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // streamText requires core messages
  const coreMessages = convertToCoreMessages(messages)
  // convertToExtendedCoreMessages for saving annotations
  const extendedCoreMessages = convertToExtendedCoreMessages(messages)

  const cookieStore = await cookies()
  const modelFromCookie = cookieStore.get('selected-model')?.value
  const model = modelFromCookie || DEFAULT_MODEL

  return createDataStreamResponse({
    execute: dataStream => {
      const researcherConfig = researcher({
        messages: coreMessages,
        model
      })

      const result = streamText({
        ...researcherConfig,
        onFinish: async event => {
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

          console.log('generatedMessages', generatedMessages)

          // Save chat with complete response and related questions
          await saveChat({
            ...savedChat,
            messages: generatedMessages
          })
        }
      })

      result.mergeIntoDataStream(dataStream)
    },
    onError: error => {
      console.error('Error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
