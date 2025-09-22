import { ModelMessage, UIMessageStreamWriter } from 'ai'

import { createRelatedQuestionsStream } from '@/lib/agents/generate-related-questions'
import { generateId } from '@/lib/db/schema'
import { relatedSchema } from '@/lib/schema/related'

/**
 * Generates and streams related questions if there are tool calls in the response
 */
export async function streamRelatedQuestions(
  writer: UIMessageStreamWriter,
  messages: ModelMessage[],
  abortSignal?: AbortSignal,
  parentTraceId?: string
): Promise<{
  questionPartId?: string
  questions?: Array<{ question: string }>
}> {
  // Check if the last message has tool calls
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage || lastMessage.role !== 'assistant') {
    return {}
  }

  const questionPartId = generateId()

  try {
    // Write loading state
    writer.write({
      type: 'data-relatedQuestions',
      id: questionPartId,
      data: { status: 'loading' }
    })

    const relatedQuestionsResult = createRelatedQuestionsStream(
      messages,
      abortSignal,
      parentTraceId
    )

    const collectedQuestions: Array<{ question: string }> = []

    for await (const question of relatedQuestionsResult.elementStream) {
      if (!question || typeof question.question !== 'string') {
        continue
      }

      collectedQuestions.push(question)

      writer.write({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: {
          status: 'streaming',
          questions: [...collectedQuestions]
        }
      })
    }

    let finalQuestions = collectedQuestions

    try {
      const completedQuestions = await relatedQuestionsResult.object
      const parsedQuestions = relatedSchema.safeParse(completedQuestions)

      if (parsedQuestions.success) {
        finalQuestions = parsedQuestions.data
      } else if (Array.isArray(completedQuestions)) {
        finalQuestions = completedQuestions
        console.warn(
          'Related questions validation failed:',
          parsedQuestions.error
        )
      }
    } catch (error) {
      console.warn('Error retrieving final related questions object:', error)
    }

    writer.write({
      type: 'data-relatedQuestions',
      id: questionPartId,
      data: {
        status: 'success',
        questions: finalQuestions
      }
    })

    return {
      questionPartId,
      questions: finalQuestions
    }
  } catch (error) {
    console.error('Error generating related questions:', error)

    // Write error state
    writer.write({
      type: 'data-relatedQuestions',
      id: questionPartId,
      data: { status: 'error' }
    })

    return { questionPartId }
  }
}
