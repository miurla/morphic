import { generateObject } from 'ai'
import { z } from 'zod'

import { getModel } from '../utils/registry'

const relatedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string()
      })
    )
    .length(3)
})

export async function generateRelatedQuestions(
  model: string,
  messages: any[],
  abortSignal?: AbortSignal
) {
  const systemPrompt = `You are a professional web researcher tasked with generating follow-up questions. Based on the conversation history and search results, create 3 DIFFERENT related questions that:

1. Explore NEW aspects not covered in the original query
2. Dig deeper into specific details mentioned in the search results
3. Connect to broader implications or related topics

Guidelines:
- NEVER repeat or rephrase the original question
- Each question should explore a UNIQUE angle or aspect
- Questions should build upon information found in the search results
- Use natural, conversational language
- Be specific and actionable

Example:
Original: "Why is Nvidia growing rapidly?"
Good follow-ups:
- "What specific AI technologies is Nvidia developing that competitors lack?"
- "How does Nvidia's data center revenue compare to its gaming division?"
- "Which companies are Nvidia's biggest customers for AI chips?"

Bad follow-ups (avoid these):
- "Why is Nvidia growing so fast?" (rephrases original)
- "Is Nvidia growing?" (less specific than original)
- "Tell me about Nvidia" (too general)`

  const { object } = await generateObject({
    model: getModel(model),
    schema: relatedQuestionsSchema,
    schemaName: 'RelatedQuestions',
    schemaDescription:
      'Generate 3 unique follow-up questions that explore different aspects of the topic',
    system: systemPrompt,
    messages: [
      ...messages,
      {
        role: 'user',
        content:
          'Based on the conversation history and search results, generate 3 unique follow-up questions that would help the user explore different aspects of the topic. Focus on questions that dig deeper into specific findings or explore related areas not yet covered.'
      }
    ],
    abortSignal
  })

  return object
}
