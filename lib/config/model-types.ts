import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

// Model configurations for each model type
export const MODEL_TYPE_CONFIGS: Record<ModelType, Model> = {
  speed: {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 mini',
    provider: 'OpenAI',
    providerId: 'openai',
    providerOptions: {
      openai: {
        reasoningEffort: 'medium',
        reasoningSummary: 'auto'
      }
    }
  },
  quality: {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Vercel AI Gateway',
    providerId: 'gateway',
    providerOptions: {
      gateway: {
        order: ['anthropic', 'bedrock', 'vertext']
      }
    }
  }
}

// Helper function to get model for a specific type
export function getModelForType(type: ModelType): Model {
  return MODEL_TYPE_CONFIGS[type]
}
