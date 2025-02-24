import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { createModelId } from '@/lib/utils'
import { isProviderEnabled, isToolCallSupported } from '@/lib/utils/registry'
import { cookies } from 'next/headers'

export const maxDuration = 30

const DEFAULT_MODEL = 'gpt-4o-mini'

export async function POST(req: Request) {
  try {
    const { messages, id: chatId } = await req.json()
    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    const cookieStore = await cookies()
    const modelJson = cookieStore.get('selectedModel')?.value
    const searchMode = cookieStore.get('search-mode')?.value === 'true'
    
    let modelId = DEFAULT_MODEL
    let provider = 'openai'
    
    if (modelJson) {
      try {
        const selectedModel = JSON.parse(modelJson) as Model
        modelId = createModelId(selectedModel)
        provider = selectedModel.providerId
      } catch (e) {
        console.error('Failed to parse selected model:', e)
      }
    }

    if (!isProviderEnabled(provider)) {
      return new Response(`Selected provider is not enabled ${provider}`, {
        status: 404,
        statusText: 'Not Found'
      })
    }

    const supportsToolCalling = isToolCallSupported(modelId)

    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: modelId,
          chatId,
          searchMode
        })
      : createManualToolStreamResponse({
          messages,
          model: modelId,
          chatId,
          searchMode
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
