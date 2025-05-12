import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages
  })

  return result.toDataStreamResponse()
}

// import { getCurrentUserId } from '@/lib/auth/get-current-user'
// import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
// import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
// import { Model } from '@/lib/types/models'
// import { isProviderEnabled } from '@/lib/utils/registry'
// import { cookies } from 'next/headers'

// export const maxDuration = 30

// const DEFAULT_MODEL: Model = {
//   id: 'gpt-4o-mini',
//   name: 'GPT-4o mini',
//   provider: 'OpenAI',
//   providerId: 'openai',
//   enabled: true,
//   toolCallType: 'native'
// }

// export async function POST(req: Request) {
//   try {
//     const { messages, id: chatId } = await req.json()
//     const referer = req.headers.get('referer')
//     const isSharePage = referer?.includes('/share/')
//     const userId = await getCurrentUserId()

//     if (isSharePage) {
//       return new Response('Chat API is not available on share pages', {
//         status: 403,
//         statusText: 'Forbidden'
//       })
//     }

//     const cookieStore = await cookies()
//     const modelJson = cookieStore.get('selectedModel')?.value
//     const searchMode = cookieStore.get('search-mode')?.value === 'true'

//     let selectedModel = DEFAULT_MODEL

//     if (modelJson) {
//       try {
//         selectedModel = JSON.parse(modelJson) as Model
//       } catch (e) {
//         console.error('Failed to parse selected model:', e)
//       }
//     }

//     if (
//       !isProviderEnabled(selectedModel.providerId) ||
//       selectedModel.enabled === false
//     ) {
//       return new Response(
//         `Selected provider is not enabled ${selectedModel.providerId}`,
//         {
//           status: 404,
//           statusText: 'Not Found'
//         }
//       )
//     }

//     const supportsToolCalling = selectedModel.toolCallType === 'native'

//     return supportsToolCalling
//       ? createToolCallingStreamResponse({
//           messages,
//           model: selectedModel,
//           chatId,
//           searchMode,
//           userId
//         })
//       : createManualToolStreamResponse({
//           messages,
//           model: selectedModel,
//           chatId,
//           searchMode,
//           userId
//         })
//   } catch (error) {
//     console.error('API route error:', error)
//     return new Response('Error processing your request', {
//       status: 500,
//       statusText: 'Internal Server Error'
//     })
//   }
// }
