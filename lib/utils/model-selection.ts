import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { DEFAULT_MODEL } from '@/lib/config/default-model'
import { isCloudDeployment } from '@/lib/config/load-models-config'
import {
  MODEL_SELECTION_COOKIE,
  parseModelSelectionCookie
} from '@/lib/config/model-selection-cookie'
import { getModelForMode } from '@/lib/config/model-types'
import { fetchAvailableModels } from '@/lib/models/fetch-models'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'
import { isProviderEnabled } from '@/lib/utils/registry'

const MODE_FALLBACK_ORDER: SearchMode[] = ['quick', 'adaptive']
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama',
  gateway: 'Gateway',
  'openai-compatible': 'OpenAI Compatible'
}

function buildProviderOptions(
  providerId: string,
  _modelId: string
): Model['providerOptions'] | undefined {
  if (providerId === 'ollama') {
    return {
      ollama: {
        think: true
      }
    }
  }

  return undefined
}

function pickFirstFetchedModel(
  modelsByProvider: Record<string, Model[]>
): Model | null {
  const providers = Object.keys(modelsByProvider).sort((a, b) =>
    a.localeCompare(b)
  )

  for (const provider of providers) {
    const firstModel = modelsByProvider[provider]?.[0]
    if (firstModel) {
      return firstModel
    }
  }

  return null
}

interface ModelSelectionParams {
  searchMode?: SearchMode
  cookieStore?: ReadonlyRequestCookies
}

function buildLocalCookieModel(providerId: string, modelId: string): Model {
  const providerOptions = buildProviderOptions(providerId, modelId)

  return {
    id: modelId,
    name: modelId,
    provider: PROVIDER_LABELS[providerId] ?? providerId,
    providerId,
    ...(providerOptions ? { providerOptions } : {})
  }
}

function resolveModelForMode(mode: SearchMode): Model | undefined {
  try {
    const model = getModelForMode(mode)
    if (!model) {
      return undefined
    }

    if (!isProviderEnabled(model.providerId)) {
      console.warn(
        `[ModelSelection] Provider "${model.providerId}" is not enabled for mode "${mode}"`
      )
      return undefined
    }

    return model
  } catch (error) {
    console.error(
      `[ModelSelection] Failed to load model configuration for mode "${mode}":`,
      error
    )
    return undefined
  }
}

/**
 * Determines which model to use based on search mode preference.
 *
 * Priority order:
 * 1. Use cloud mode-specific model for the active mode when enabled
 * 2. If the active mode has no enabled model, try remaining modes
 * 3. Use DEFAULT_MODEL when its provider is enabled
 * 4. Return null when no enabled models are available
 */
export async function selectModel({
  searchMode,
  cookieStore
}: ModelSelectionParams): Promise<Model | null> {
  if (!isCloudDeployment()) {
    const parsedCookie = parseModelSelectionCookie(
      cookieStore?.get(MODEL_SELECTION_COOKIE)?.value
    )

    if (parsedCookie) {
      try {
        if (!isProviderEnabled(parsedCookie.providerId)) {
          console.warn(
            `[ModelSelection] Saved model provider "${parsedCookie.providerId}" is not enabled.`
          )
        } else {
          return buildLocalCookieModel(
            parsedCookie.providerId,
            parsedCookie.modelId
          )
        }
      } catch (error) {
        console.error(
          '[ModelSelection] Failed to resolve model from cookie:',
          error
        )
      }
    }

    if (isProviderEnabled(DEFAULT_MODEL.providerId)) {
      return DEFAULT_MODEL
    }

    return pickFirstFetchedModel(await fetchAvailableModels())
  }

  const requestedMode =
    searchMode && MODE_FALLBACK_ORDER.includes(searchMode)
      ? searchMode
      : 'quick'

  const modePreferenceOrder: SearchMode[] = Array.from(
    new Set<SearchMode>([requestedMode, ...MODE_FALLBACK_ORDER])
  )

  for (const candidateMode of modePreferenceOrder) {
    const model = resolveModelForMode(candidateMode)
    if (model) {
      return model
    }
  }

  if (isProviderEnabled(DEFAULT_MODEL.providerId)) {
    return DEFAULT_MODEL
  }

  return pickFirstFetchedModel(await fetchAvailableModels())
}

export { DEFAULT_MODEL }
