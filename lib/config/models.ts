import { Model } from '@/lib/types/models'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

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

export function getModels(): Model[] {
  const configPath = join(process.cwd(), 'public', 'config', 'models.json')
  
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (Array.isArray(config.models) && config.models.every(validateModel)) {
      return config.models
    }
    console.warn('Invalid model configuration')
  } catch (error) {
    console.warn('Failed to load models:', error)
  }
  
  return []
}
