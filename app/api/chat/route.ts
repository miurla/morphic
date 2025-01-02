import { streamText, createDataStreamResponse } from 'ai'
import { chatResearcher } from '@/lib/agents/chat-researcher'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model } = await req.json()

  return createDataStreamResponse({
    execute: dataStream => {
      const researcherConfig = chatResearcher({
        messages,
        model
      })

      const result = streamText({
        ...researcherConfig,
        onFinish: async event => {
          // Notify the client that related queries are coming
          dataStream.writeMessageAnnotation({
            type: 'related-queries',
            relatedQueries: {
              items: []
            }
          })

          // Generate related queries
          const responseMessages = event.response.messages
          const relatedQueries = await generateRelatedQuestions(
            responseMessages,
            model
          )

          // Notify the client with the generated related queries
          dataStream.writeMessageAnnotation({
            type: 'related-queries',
            relatedQueries: relatedQueries.object
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
