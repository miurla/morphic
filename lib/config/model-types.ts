import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

// Model configurations for each model type
export const MODEL_TYPE_CONFIGS: Record<ModelType, Model> = {
  speed: {
    id: 'gpt-5-nano-2025-08-07',
    name: 'GPT-5 nano',
    provider: 'OpenAI',
    providerId: 'openai',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
        reasoningSummary: 'detailed'
      }
    }
  },
  quality: {
    id: 'gpt-5-2025-08-07',
    name: 'GPT-5',
    provider: 'OpenAI',
    providerId: 'openai',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
        reasoningSummary: 'detailed'
      }
    }
  }
}

// Helper function to get model for a specific type
export function getModelForType(type: ModelType): Model {
  return MODEL_TYPE_CONFIGS[type]
}
