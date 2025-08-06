import { unstable_cache } from 'next/cache'

import { Model } from '@/lib/types/models'

import defaultModels from './default-models.json'

export function validateModel(model: any): model is Model {
  return (
    typeof model.id === 'string' &&
    typeof model.name === 'string' &&
    typeof model.provider === 'string' &&
    typeof model.providerId === 'string'
  )
}

const getModelsUncached = async function (baseUrl: string): Promise<Model[]> {
  try {
    // Construct the models.json URL using the provided baseUrl
    const modelUrl = new URL('/config/models.json', baseUrl)
    console.log('Attempting to fetch models from:', modelUrl.toString())

    try {
      const response = await fetch(modelUrl, {
        next: { revalidate: 0 },
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
        return config.models
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
        return defaultModels.models
      }
    }
  } catch (error) {
    console.warn('Failed to load models:', error)
  }

  // Last resort: return empty array
  console.warn('All attempts to load models failed, returning empty array')
  return []
}

// Cached version with 1 hour revalidation
const getCachedModels = unstable_cache(getModelsUncached, ['models'], {
  revalidate: 3600, // 1 hour cache
  tags: ['models']
})

// Wrapper function that handles the dynamic baseUrl
export async function getModels(): Promise<Model[]> {
  const { getBaseUrl } = await import('@/lib/utils/url')
  const baseUrlObj = await getBaseUrl()
  return getCachedModels(baseUrlObj.toString())
}
