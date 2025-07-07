import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'
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
        // Filter models based on enabled flag and provider availability
        const filteredModels = config.models.filter(
          (model: Model) => model.enabled && isProviderEnabled(model.providerId)
        )
        console.log(`Filtered ${config.models.length} models to ${filteredModels.length} available models`)
        return filteredModels
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
        // Filter default models based on enabled flag and provider availability
        const filteredModels = defaultModels.models.filter(
          (model: Model) => model.enabled && isProviderEnabled(model.providerId)
        )
        console.log(`Filtered ${defaultModels.models.length} default models to ${filteredModels.length} available models`)
        return filteredModels
      }
    }
  } catch (error) {
    console.warn('Failed to load models:', error)
  }

  // Last resort: return empty array
  console.warn('All attempts to load models failed, returning empty array')
  return []
}

