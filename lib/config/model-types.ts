import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

// Model configurations for each model type
export const MODEL_TYPE_CONFIGS: Record<ModelType, Model> = {
  speed: {
    id: 'moonshotai/kimi-k2',
    name: 'Kimi K2',
    provider: 'Vercel AI Gateway',
    providerId: 'gateway',
    providerOptions: {
      gateway: {
        order: ['groq', 'deepinfra'],
        only: ['groq']
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
