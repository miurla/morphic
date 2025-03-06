import { Model } from '@/lib/types/models'
import { headers } from 'next/headers'

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
        console.log('Using x-base-url:', baseUrl)
        baseUrlObj = new URL(baseUrl)
      } else if (url) {
        console.log('Using x-url:', url)
        baseUrlObj = new URL(url)
      } else if (host) {
        const constructedUrl = `${protocol}${
          protocol.endsWith(':') ? '//' : '://'
        }${host}`
        console.log('Constructed URL from host and protocol:', constructedUrl)
        baseUrlObj = new URL(constructedUrl)
      } else {
        console.log('Using default localhost URL')
        baseUrlObj = new URL('http://localhost:3000')
      }
    } catch (urlError) {
      // Fallback to default URL if any error occurs during URL construction
      console.warn('Error constructing URL:', urlError)
      console.log('Falling back to default localhost URL')
      baseUrlObj = new URL('http://localhost:3000')
    }

    // Construct the models.json URL
    const modelUrl = new URL('/config/models.json', baseUrlObj)

    console.log('Fetching models from:', modelUrl.toString())

    const response = await fetch(modelUrl, {
      cache: 'no-store'
    })
    const config = await response.json()
    if (Array.isArray(config.models) && config.models.every(validateModel)) {
      return config.models
    }
    console.warn('Invalid model configuration')
  } catch (error) {
    console.warn('Failed to load models:', error)
  }

  return []
}
