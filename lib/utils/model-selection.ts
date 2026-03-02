import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { getModelForModeAndType } from '@/lib/config/model-types'
import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'
import { isProviderEnabled } from '@/lib/utils/registry'

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

const VALID_MODEL_TYPES: ModelType[] = ['speed', 'quality']
const MODE_FALLBACK_ORDER: SearchMode[] = ['quick', 'adaptive']

interface ModelSelectionParams {
  cookieStore: ReadonlyRequestCookies
  searchMode?: SearchMode
}

function resolveModelForModeAndType(
  mode: SearchMode,
  type: ModelType
): Model | undefined {
  try {
    const model = getModelForModeAndType(mode, type)
    if (!model) {
      return undefined
    }

    if (!isProviderEnabled(model.providerId)) {
      console.warn(
        `[ModelSelection] Provider "${model.providerId}" is not enabled for mode "${mode}" and model type "${type}"`
      )
      return undefined
    }

    return model
  } catch (error) {
    console.error(
      `[ModelSelection] Failed to load model configuration for mode "${mode}" and type "${type}":`,
      error
    )
    return undefined
  }
}

/**
 * Determines which model to use based on the model type preference.
 *
 * Priority order:
 * 1. If model type is in cookie -> use corresponding model from config (when enabled)
 * 2. Otherwise -> use default ordering (speed → quality) for the active mode
 * 3. If the active mode has no enabled models, try remaining modes
 * 4. If config loading fails or providers are unavailable -> use DEFAULT_MODEL as fallback
 */
export function selectModel({
  cookieStore,
  searchMode
}: ModelSelectionParams): Model {
  const modelTypeCookie = cookieStore.get('modelType')?.value as
    | ModelType
    | undefined

  const requestedMode =
    searchMode && MODE_FALLBACK_ORDER.includes(searchMode)
      ? searchMode
      : 'quick'

  const typePreferenceOrder: ModelType[] = []
  if (
    modelTypeCookie &&
    VALID_MODEL_TYPES.includes(modelTypeCookie) &&
    !typePreferenceOrder.includes(modelTypeCookie)
  ) {
    typePreferenceOrder.push(modelTypeCookie)
  }

  for (const knownType of VALID_MODEL_TYPES) {
    if (!typePreferenceOrder.includes(knownType)) {
      typePreferenceOrder.push(knownType)
    }
  }

  const modePreferenceOrder: SearchMode[] = Array.from(
    new Set<SearchMode>([requestedMode, ...MODE_FALLBACK_ORDER])
  )

  for (const candidateMode of modePreferenceOrder) {
    for (const candidateType of typePreferenceOrder) {
      const model = resolveModelForModeAndType(candidateMode, candidateType)
      if (model) {
        return model
      }
    }
  }

  if (!isProviderEnabled(DEFAULT_MODEL.providerId)) {
    console.warn(
      `[ModelSelection] Default model provider "${DEFAULT_MODEL.providerId}" is not enabled. Returning default model configuration.`
    )
  }

  return DEFAULT_MODEL
}

export { DEFAULT_MODEL }
