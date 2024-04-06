import { openai } from 'ai/openai'
import { Copilot } from '@/components/copilot'
import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { ExperimentalMessage, experimental_streamObject } from 'ai'
import { PartialInquiry, inquirySchema } from '@/app/schema/inquiry'

export async function inquire(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: ExperimentalMessage[],
  query?: string
) {
  const objectStream = createStreamableValue<PartialInquiry>()
  uiStream.update(<Copilot initialQuery={query} inquiry={objectStream.value} />)

  let finalInquiry: PartialInquiry = {}
  await experimental_streamObject({
    model: openai.chat('gpt-4-turbo-preview'),
    maxTokens: 2500,
    system: `You are a professional web researcher tasked with deepening your understanding of the user's input through further inquiries.
    Only ask additional questions if absolutely necessary after receiving an initial response from the user.
    'names' should be an array of English identifiers for the options provided. Structure your inquiry as follows:
    e.g., {
      "inquiry": "What specific information are you seeking about Rivian?",
      "options": ["History", "Products", "Investors", "Partnerships", "Competitors"],
      "names": ["history", "products", "investors", "partnerships", "competitors"],
      "allowsInput": true,
      "inputLabel": "If other, please specify",
      "inputPlaceholder": "e.g., Specifications"
    }`,
    messages,
    schema: inquirySchema
  })
    .then(async result => {
      for await (const obj of result.partialObjectStream) {
        if (obj) {
          objectStream.update(obj)
          finalInquiry = obj
        }
      }
    })
    .finally(() => {
      objectStream.done()
    })

  return finalInquiry
}
