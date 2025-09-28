import { Model } from '@/lib/types/models'
import { getBaseUrl } from '@/lib/utils/url'

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
    // Get the base URL using the centralized utility function
    const baseUrlObj = await getBaseUrl()

    // Construct the models.json URL
    const modelUrl = new URL('/config/models.json', baseUrlObj)
    console.log('Attempting to fetch models from:', modelUrl.toString())

    let staticModels: Model[] = []

    try {
      const response = await fetch(modelUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        console.warn(
          `HTTP error when fetching models: ${response.status} ${response.statusText}`
        )
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()

      // Check if the response starts with HTML doctype
      if (text.trim().toLowerCase().startsWith('<!doctype')) {
        console.warn('Received HTML instead of JSON when fetching models')
        throw new Error('Received HTML instead of JSON')
      }

      const config = JSON.parse(text)
      if (Array.isArray(config.models) && config.models.every(validateModel)) {
        console.log('Successfully loaded models from URL')
        staticModels = config.models
      }
    } catch (error: any) {
      // Fallback to default models if fetch fails
      console.warn(
        'Fetch failed, falling back to default models:',
        error.message || 'Unknown error'
      )

      if (
        Array.isArray(defaultModels.models) &&
        defaultModels.models.every(validateModel)
      ) {
        console.log('Successfully loaded default models')
        staticModels = defaultModels.models
      }
    }

    // Fetch Ollama models
    const ollamaModels = await fetchOllamaModels(baseUrlObj)

    // Combine static and Ollama models
    const allModels = [...staticModels, ...ollamaModels]

    console.log(
      `Loaded ${staticModels.length} static models and ${ollamaModels.length} Ollama models`
    )
    return allModels
  } catch (error) {
    console.warn('Failed to load models:', error)
  }

  // Last resort: return empty array
  console.warn('All attempts to load models failed, returning empty array')
  return []
}

/**
 * Fetch Ollama models from the API endpoint
 */
async function fetchOllamaModels(baseUrl: URL): Promise<Model[]> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL
    if (!ollamaUrl) {
      console.log('OLLAMA_BASE_URL not configured, skipping Ollama models')
      return []
    }

    const ollamaApiUrl = new URL('/api/ollama/models', baseUrl)
    console.log(
      'Attempting to fetch Ollama models from:',
      ollamaApiUrl.toString()
    )

    const response = await fetch(ollamaApiUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      console.warn(
        `HTTP error when fetching Ollama models: ${response.status} ${response.statusText}`
      )
      return []
    }

    const data = await response.json()
    if (Array.isArray(data.models)) {
      console.log(`Successfully loaded ${data.models.length} Ollama models`)
      return data.models
    }

    return []
  } catch (error) {
    console.warn('Failed to fetch Ollama models:', error)
    return []
  }
}
