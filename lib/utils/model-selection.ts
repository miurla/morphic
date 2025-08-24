import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { getSearchModeModels } from '@/lib/config/search-modes'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai'
}

interface ModelSelectionParams {
  cookieStore: ReadonlyRequestCookies
  searchModeFromRequest?: SearchMode
  showModelSelector?: boolean
}

/**
 * Determines which model to use based on the current configuration and user preferences
 *
 * Priority order:
 * 1. If model selector is enabled AND user has selected a model -> use selected model
 * 2. If search mode is provided in request -> use mode's default model
 * 3. If search mode is in cookie -> use mode's default model
 * 4. Otherwise -> use DEFAULT_MODEL
 */
export function selectModel({
  cookieStore,
  searchModeFromRequest,
  showModelSelector = process.env.NEXT_PUBLIC_SHOW_MODEL_SELECTOR === 'true'
}: ModelSelectionParams): Model {
  const modelJson = cookieStore.get('selectedModel')?.value
  const searchModeCookie = cookieStore.get('searchMode')?.value as
    | SearchMode
    | undefined
  const SEARCH_MODE_MODELS = getSearchModeModels()

  // Priority 1: Model selector is enabled and user has selected a model
  if (showModelSelector && modelJson) {
    try {
      return JSON.parse(modelJson) as Model
    } catch (e) {
      console.error('Failed to parse selected model:', e)
    }
  }

  // Priority 2: Search mode from request
  if (searchModeFromRequest && searchModeFromRequest in SEARCH_MODE_MODELS) {
    return SEARCH_MODE_MODELS[searchModeFromRequest]
  }

  // Priority 3: Search mode from cookie
  if (searchModeCookie && searchModeCookie in SEARCH_MODE_MODELS) {
    return SEARCH_MODE_MODELS[searchModeCookie]
  }

  // Priority 4: Default model
  return DEFAULT_MODEL
}

export { DEFAULT_MODEL }
