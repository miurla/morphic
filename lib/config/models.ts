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
    (model.toolCallModel === undefined || typeof model.toolCallModel === 'string')
  )
}

export async function getModels(): Promise<Model[]> {
  try {
    const headersList = await headers()
    const baseUrl = new URL(headersList.get('x-url') || 'http://localhost:3000')
    const modelUrl = new URL('/config/models.json', baseUrl.origin)

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
