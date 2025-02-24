import { Model } from '@/lib/types/models'

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
    const response = await fetch('/config/models.json')
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
