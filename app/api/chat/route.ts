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
