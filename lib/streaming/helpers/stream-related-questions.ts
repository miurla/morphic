import { ModelMessage, UIMessageStreamWriter } from 'ai'

import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { generateId } from '@/lib/db/schema'

/**
 * Generates and streams related questions if there are tool calls in the response
 */
export async function streamRelatedQuestions(
  writer: UIMessageStreamWriter,
  messages: ModelMessage[],
  abortSignal?: AbortSignal,
  parentTraceId?: string
): Promise<{ questionPartId?: string; questions?: any[] }> {
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

    // Generate related questions
    const relatedQuestions = await generateRelatedQuestions(
      messages,
      abortSignal,
      parentTraceId
    )

    // Write success state
    writer.write({
      type: 'data-relatedQuestions',
      id: questionPartId,
      data: {
        status: 'success',
        questions: relatedQuestions.questions
      }
    })

    return {
      questionPartId,
      questions: relatedQuestions.questions
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
