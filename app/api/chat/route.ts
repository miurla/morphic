import { chatResearcher } from '@/lib/agents/chat-researcher'
import { streamText } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model } = await req.json()

  const researcherConfig = await chatResearcher({
    messages,
    model
  })

  const result = streamText(researcherConfig)

  return result.toDataStreamResponse()
}
