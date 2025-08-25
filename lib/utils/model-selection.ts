import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { getModelForType } from '@/lib/config/model-types'
import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai'
}

interface ModelSelectionParams {
  cookieStore: ReadonlyRequestCookies
}

/**
 * Determines which model to use based on the model type preference
 *
 * Priority order:
 * 1. If model type is in cookie -> use corresponding model
 * 2. Otherwise -> use DEFAULT_MODEL
 */
export function selectModel({ cookieStore }: ModelSelectionParams): Model {
  const modelTypeCookie = cookieStore.get('modelType')?.value as
    | ModelType
    | undefined

  // If model type is set, use the corresponding model
  if (modelTypeCookie && ['speed', 'quality'].includes(modelTypeCookie)) {
    return getModelForType(modelTypeCookie)
  }

  // Default model
  return DEFAULT_MODEL
}

export { DEFAULT_MODEL }
