import { ExperimentalMessage, experimental_generateObject } from 'ai'
import { openai } from 'ai/openai'
import { nextActionSchema } from '../schema/next-action'

// Decide whether inquiry is required for the user input
export async function taskManager(messages: ExperimentalMessage[]) {
  const result = await experimental_generateObject({
    model: openai.chat('gpt-3.5-turbo'),
    system: `You are a professional web researcher tasked with fully understanding the user's query, conducting web searches for the necessary information, and responding accordingly. 
    Your goal is to comprehend the user's input and determine the next step. You have the option to present a form and request further information from the user.
    Select one of the three options based on the context: "proceed", "inquire". Use "proceed" if the provided information is sufficient for action.
    Opt for "inquire" if more information can be gathered through questions, allowing for default selections and free-form input.
    Make your choice wisely to fulfill your mission effectively.`,
    messages,
    schema: nextActionSchema
  })

  return result
}
