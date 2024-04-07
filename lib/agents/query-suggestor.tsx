import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { ExperimentalMessage, experimental_streamObject } from 'ai'
import { PartialRelated, relatedSchema } from '@/lib/schema/related'
import { Section } from '@/components/section'
import SearchRelated from '@/components/search-related'
import { openai } from 'ai/openai'

export async function querySuggestor(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: ExperimentalMessage[]
) {
  const objectStream = createStreamableValue<PartialRelated>()
  uiStream.append(
    <Section title="Related" separator={true}>
      <SearchRelated relatedQueries={objectStream.value} />
    </Section>
  )

  await experimental_streamObject({
    model: openai.chat('gpt-4-turbo-preview'),
    system: `You are tasked as a professional web researcher to generate queries that delve deeper into the subject based on the initial query and its search results. Your goal is to formulate three related questions.
    For example, given the query: "Starship's third test flight key milestones",
    Your output should look like:
    "{
      "related": [
        "Key milestones achieved during Starship's third test flight",
        "Reason for Starship's failure during the third test flight",
        "Future plans for Starship following the third test flight"
      ]
    }"`,
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
