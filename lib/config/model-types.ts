import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

import { getModelsConfig } from './load-models-config'

// Get model for a specific type from JSON config
export function getModelForType(type: ModelType): Model {
  const cfg = getModelsConfig()
  return cfg.models.types[type]
}

// Get model for related questions generation from JSON config
export function getRelatedQuestionsModel(): Model {
  const cfg = getModelsConfig()
  return cfg.models.relatedQuestions
}
