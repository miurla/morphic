import { streamText, createDataStreamResponse } from 'ai'
import { researcher } from '@/lib/agents/researcher'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { cookies } from 'next/headers'

export const maxDuration = 30

const DEFAULT_MODEL = 'openai:gpt-4o-mini'

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Get the model from the cookie
  const cookieStore = await cookies()
  const modelFromCookie = cookieStore.get('selected-model')?.value
  const model = modelFromCookie || DEFAULT_MODEL

  return createDataStreamResponse({
    execute: dataStream => {
      const researcherConfig = researcher({
        messages,
        model
      })

      const result = streamText({
        ...researcherConfig,
        onFinish: async event => {
          // Notify the client that related questions are coming
          dataStream.writeMessageAnnotation({
            type: 'related-questions',
            relatedQuestions: {
              items: []
            },
            status: 'loading'
          })

          // Generate related questions
          const responseMessages = event.response.messages
          const relatedQuestions = await generateRelatedQuestions(
            responseMessages,
            model
          )

          // Notify the client with the generated related questions
          dataStream.writeMessageAnnotation({
            type: 'related-questions',
            relatedQuestions: relatedQuestions.object,
            status: 'done'
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
