import { Experimental_Agent as Agent, tool } from 'ai'

import { relatedSchema } from '../schema/related'
import { getModel } from '../utils/registry'

export function generateRelatedQuestions(model: string) {
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

  // Return an agent instance for related questions
  return new Agent({
    model: getModel(model),
    system:
      systemPrompt +
      '\n\nGenerate 3 unique follow-up questions that explore different aspects of the topic.',
    tools: {
      relatedQuestions: tool({
        name: 'relatedQuestions',
        description:
          'Generate 3 unique follow-up questions that explore different aspects of the topic, avoiding repetition of the original query',
        inputSchema: relatedSchema,
        execute: async ({ questions }) => {
          // Return the questions in the expected format
          return { questions }
        }
      })
    },
    activeTools: ['relatedQuestions'],
    toolChoice: 'required'
  })
}
