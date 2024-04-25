import { OpenAI } from '@ai-sdk/openai'
import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { ExperimentalMessage, experimental_streamText } from 'ai'
import { Section } from '@/components/section'
import { BotMessage } from '@/components/message'
import { createAnthropic } from '@ai-sdk/anthropic';
export async function writer(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamText: ReturnType<typeof createStreamableValue<string>>,
  messages: ExperimentalMessage[]
) {
  // Delete the following if not needed in future or revert back if needed

  // const openai = new OpenAI({
  //   baseUrl: process.env.SPECIFIC_API_BASE,
  //   apiKey: process.env.SPECIFIC_API_KEY,
  //   organization: '' // optional organization
  // })
  const anthropic = createAnthropic({
    baseUrl: process.env.ANTHROPIC_API_BASE,
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
  let fullResponse = ''
  const answerSection = (
    <Section title="Answer">
      <BotMessage content={streamText.value} />
    </Section>
  )
  uiStream.append(answerSection)

  await experimental_streamText({
    // Delete the following if not needed in future or revert back if needed
    // model: openai.chat(process.env.SPECIFIC_API_MODEL || 'llama3-70b-8192'),
    model: anthropic(process.env.ANTHROPIC_API_MODEL_ID || 'claude-3-haiku-20240307'),
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
