import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, streamText as nonexperimental_streamText } from 'ai'
import { Section } from '@/components/section'
import { BotMessage } from '@/components/message'
import { OpenAI } from '@ai-sdk/openai'

export async function writer(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamText: ReturnType<typeof createStreamableValue<string>>,
  messages: CoreMessage[]
) {
  let fullResponse = ''
  const answerSection = (
    <Section title="Answer">
      <BotMessage content={streamText.value} />
    </Section>
  )
  uiStream.append(answerSection)

  const openai = new OpenAI({
    baseUrl: process.env.SPECIFIC_API_BASE,
    apiKey: process.env.SPECIFIC_API_KEY,
    organization: '' // optional organization
  })

  await nonexperimental_streamText({
    model: openai!.chat(process.env.SPECIFIC_API_MODEL || 'llama3-70b-8192'),
    maxTokens: 2500,
    system: `As a professional writer, your job is to generate a comprehensive and informative, yet concise answer of 400 words or less for the given question based solely on the provided search results (URL and content). You must only use information from the provided search results. Use an unbiased and journalistic tone. Combine search results together into a coherent answer. Do not repeat text. If there are any images relevant to your answer, be sure to include them as well. Aim to directly address the user's question, augmenting your response with insights gleaned from the search results. 
    Whenever quoting or referencing information from a specific URL, always cite the source URL explicitly. Please match the language of the response to the user's language.
    Always answer in Markdown format. Links and images must follow the correct format.
    Link format: [link text](url)
    Image format: ![alt text](url)
    `,
    messages
  })
    .then(async result => {
      for await (const text of result.textStream) {
        if (text) {
          fullResponse += text
          streamText.update(fullResponse)
        }
      }
    })
    .finally(() => {
      streamText.done()
    })

  return fullResponse
}
