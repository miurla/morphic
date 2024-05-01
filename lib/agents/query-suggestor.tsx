import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { ExperimentalMessage, experimental_streamObject } from 'ai'
import { PartialRelated, relatedSchema } from '@/lib/schema/related'
import { Section } from '@/components/section'
import SearchRelated from '@/components/search-related'
import { OpenAI } from '@ai-sdk/openai'

export async function querySuggestor(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: ExperimentalMessage[]
) {
  const openai = new OpenAI({
    baseUrl: process.env.OPENAI_API_BASE, // optional base URL for proxies etc.
    apiKey: process.env.OPENAI_API_KEY, // optional API key, default to env property OPENAI_API_KEY
    organization: '' // optional organization
  })
  const objectStream = createStreamableValue<PartialRelated>()
  uiStream.append(
    <Section title="Related" separator={true}>
      <SearchRelated relatedQueries={objectStream.value} />
    </Section>
  )

  await experimental_streamObject({
    model: openai.chat(process.env.OPENAI_API_MODEL || 'gpt-4-turbo'),
    system: `As a Shopify search bot, your task is to generate a set of three queries to suggest similar products, building upon the initial query and the information uncovered in its search results.

    For instance, if the original query was "Sony 40 inch TV with Plasma Display", your output should follow this format:

    "{
      "related": [
        "Panasonic 50 inch 4K Plasma",
        "Panasonic 50 inch 720p LED",
        "Sony 40 inch 720p OLED"
      ]
    }"

    Aim to create queries that let user explore similar or alternate products related to the initial query. The goal is to provide user best product suggestions and guide them towards purchasing it.
    Please match the language of the response to the user's language.`,
    messages,
    schema: relatedSchema
  })
    .then(async result => {
      for await (const obj of result.partialObjectStream) {
        objectStream.update(obj)
      }
    })
    .finally(() => {
      objectStream.done()
    })
}
