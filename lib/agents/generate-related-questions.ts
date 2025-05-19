import { generateObject, ModelMessage, streamText, tool } from 'ai'
import { z } from 'zod'
import { relatedSchema } from '../schema/related'
import { getModel } from '../utils/registry'

export function generateRelatedQuestions(
  messages: ModelMessage[],
  model: string
) {
  const lastMessages = messages.slice(-1).map(message => ({
    ...message,
    role: 'user'
  })) as ModelMessage[]

  const systemPrompt = `As a professional web researcher, generate 3 related queries that explore the topic more deeply, based on the initial query and search results.

    The queries should:
    - Progress from general to specific aspects
    - Cover implications and connected topics
    - Match the user's language style and level
    - Help build comprehensive understanding
    - Be relevant and naturally follow from the context

    Example format for "Starship's third test flight key milestones":
    - "What technical improvements were made for Starship's third test flight?"
    - "How does the third flight's performance compare to previous launches?"
    - "What are the implications of this test flight for future Starship missions?"`

  const result = streamText({
    model: getModel(model),
    system:
      'Generate related questions.  Use the generateRelatedQuestions tool exactly once to provide the related questions.',
    messages: lastMessages,
    tools: {
      related_questions: tool({
        description: 'Generate related questions',
        parameters: z.object({}),
        execute: async () => {
          const questions = await generateObject({
            model: getModel(model),
            system: systemPrompt,
            messages: lastMessages,
            schema: relatedSchema
          })

          return questions.object
        }
      })
    },
    toolChoice: 'required'
  })

  return result
}
