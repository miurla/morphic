import { Model } from '@/lib/types/models'
import { headers } from 'next/headers'
import defaultModels from './default-models.json'

export function validateModel(model: any): model is Model {
  return (
    typeof model.id === 'string' &&
    typeof model.name === 'string' &&
    typeof model.provider === 'string' &&
    typeof model.providerId === 'string' &&
    typeof model.enabled === 'boolean' &&
    (model.toolCallType === 'native' || model.toolCallType === 'manual') &&
    (model.toolCallModel === undefined ||
      typeof model.toolCallModel === 'string')
  )
}

export async function getModels(): Promise<Model[]> {
  try {
    const headersList = await headers()
    const baseUrl = headersList.get('x-base-url')
    const url = headersList.get('x-url')
    const host = headersList.get('x-host')
    const protocol = headersList.get('x-protocol') || 'http:'

    // Construct base URL using the headers
    let baseUrlObj: URL

    try {
      // Try to use the pre-constructed base URL if available
      if (baseUrl) {
        baseUrlObj = new URL(baseUrl)
      } else if (url) {
        baseUrlObj = new URL(url)
      } else if (host) {
        const constructedUrl = `${protocol}${
          protocol.endsWith(':') ? '//' : '://'
        }${host}`
        baseUrlObj = new URL(constructedUrl)
      } else {
        baseUrlObj = new URL('http://localhost:3000')
      }
    } catch (urlError) {
      // Fallback to default URL if any error occurs during URL construction
      baseUrlObj = new URL('http://localhost:3000')
    }

    // Construct the models.json URL
    const modelUrl = new URL('/config/models.json', baseUrlObj)

    try {
      const response = await fetch(modelUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()

      // Check if the response starts with HTML doctype
      if (text.trim().toLowerCase().startsWith('<!doctype')) {
        throw new Error('Received HTML instead of JSON')
      }

      const config = JSON.parse(text)
      if (Array.isArray(config.models) && config.models.every(validateModel)) {
        return config.models
      }
    } catch (fetchError) {
      // Fallback to default models if fetch fails
      if (
        Array.isArray(defaultModels.models) &&
        defaultModels.models.every(validateModel)
      ) {
        return defaultModels.models
      }
    }
  } catch (error) {
    console.warn('Failed to load models:', error)
  }

  // Last resort: return empty array
  return []
}
