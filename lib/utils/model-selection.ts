import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { getModelForType } from '@/lib/config/model-types'
import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

const DEFAULT_MODEL: Model = {
  id: 'gpt-5-mini',
  name: 'GPT-5 mini',
  provider: 'OpenAI',
  providerId: 'openai',
  providerOptions: {
    openai: {
      reasoningEffort: 'low',
      reasoningSummary: 'auto'
    }
  }
}

interface ModelSelectionParams {
  cookieStore: ReadonlyRequestCookies
}

/**
 * Determines which model to use based on the model type preference
 *
 * Priority order:
 * 1. If model type is in cookie -> use corresponding model from config
 * 2. Otherwise -> use default 'speed' model from config
 * 3. If config loading fails -> use DEFAULT_MODEL as fallback
 */
export function selectModel({ cookieStore }: ModelSelectionParams): Model {
  const modelTypeCookie = cookieStore.get('modelType')?.value as
    | ModelType
    | undefined

  try {
    // If model type is set in cookie, use it
    if (modelTypeCookie && ['speed', 'quality'].includes(modelTypeCookie)) {
      const model = getModelForType(modelTypeCookie)
      if (model) return model
    }

    // Default to 'speed' model from config when no cookie is set
    const defaultModel = getModelForType('speed')
    if (defaultModel) return defaultModel
  } catch (error) {
    console.error('Error loading model from config:', error)
  }

  // Fallback to hardcoded DEFAULT_MODEL if config loading fails
  return DEFAULT_MODEL
}

export { DEFAULT_MODEL }
