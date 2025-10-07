import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'

import { getModelsConfig } from './load-models-config'

// Retrieve the model assigned to a specific search mode and model type combination.
export function getModelForModeAndType(
  mode: SearchMode,
  type: ModelType
): Model | undefined {
  const cfg = getModelsConfig()
  return cfg.models.byMode?.[mode]?.[type]
}

// Accessor for the related questions model configuration.
export function getRelatedQuestionsModel(): Model {
  const cfg = getModelsConfig()
  return cfg.models.relatedQuestions
}
