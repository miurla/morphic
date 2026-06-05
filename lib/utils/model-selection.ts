import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { DEFAULT_MODEL } from '@/lib/config/default-model'
import { isCloudDeployment } from '@/lib/config/load-models-config'
import {
  MODEL_SELECTION_COOKIE,
  parseModelSelectionCookie
} from '@/lib/config/model-selection-cookie'
import { getModelForMode } from '@/lib/config/model-types'
import {
  getSearchModelPreferenceScore,
  isSearchCompatibleModel
} from '@/lib/models/compatibility'
import { fetchAvailableModels } from '@/lib/models/fetch-models'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'
import { isProviderEnabled } from '@/lib/utils/registry'

const MODE_FALLBACK_ORDER: SearchMode[] = ['quick', 'adaptive']

function pickFirstFetchedModel(
  modelsByProvider: Record<string, Model[]>,
  preferredProviderId?: string
): Model | null {
  const hasPreferredProvider = (provider: string) =>
    Boolean(
      preferredProviderId &&
        modelsByProvider[provider]?.some(
          model => model.providerId === preferredProviderId
        )
    )

  const providers = Object.keys(modelsByProvider).sort((a, b) => {
    if (hasPreferredProvider(a)) return -1
    if (hasPreferredProvider(b)) return 1
    return a.localeCompare(b)
  })

  for (const provider of providers) {
    const firstModel = [...(modelsByProvider[provider] ?? [])]
      .sort(
        (a, b) =>
          getSearchModelPreferenceScore(a.providerId, a.id) -
          getSearchModelPreferenceScore(b.providerId, b.id)
      )
      .find(model => isSearchCompatibleModel(model.providerId, model.id))
    if (firstModel) {
      return firstModel
    }
  }

  return null
}

function findFetchedModel(
  modelsByProvider: Record<string, Model[]>,
  providerId: string,
  modelId: string
): Model | null {
  return (
    Object.values(modelsByProvider)
      .flat()
      .find(
        model =>
          model.providerId === providerId &&
          model.id === modelId &&
          isSearchCompatibleModel(model.providerId, model.id)
      ) ?? null
  )
}

interface ModelSelectionParams {
  searchMode?: SearchMode
  cookieStore?: ReadonlyRequestCookies
}

function resolveModelForMode(
  mode: SearchMode,
  cookieStore?: ReadonlyRequestCookies
): Model | undefined {
  try {
    const model = getModelForMode(mode)
    if (!model) {
      return undefined
    }

    if (!isProviderEnabled(model.providerId, cookieStore)) {
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
        if (!isProviderEnabled(parsedCookie.providerId, cookieStore)) {
          console.warn(
            `[ModelSelection] Saved model provider "${parsedCookie.providerId}" is not enabled.`
          )
        } else {
          const availableModels = await fetchAvailableModels()
          const matchedModel = findFetchedModel(
            availableModels,
            parsedCookie.providerId,
            parsedCookie.modelId
          )

          if (matchedModel) {
            return matchedModel
          }

          if (
            !isSearchCompatibleModel(
              parsedCookie.providerId,
              parsedCookie.modelId
            )
          ) {
            console.warn(
              `[ModelSelection] Saved model "${parsedCookie.providerId}:${parsedCookie.modelId}" is not compatible with search.`
            )
          } else {
            console.warn(
              `[ModelSelection] Saved model "${parsedCookie.providerId}:${parsedCookie.modelId}" is no longer available.`
            )
          }

          const sameProviderFallback = pickFirstFetchedModel(
            availableModels,
            parsedCookie.providerId
          )
          if (sameProviderFallback) {
            return sameProviderFallback
          }

          return pickFirstFetchedModel(availableModels)
        }
      } catch (error) {
        console.error(
          '[ModelSelection] Failed to resolve model from cookie:',
          error
        )
      }
    }

    if (isProviderEnabled(DEFAULT_MODEL.providerId, cookieStore)) {
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
    const model = resolveModelForMode(candidateMode, cookieStore)
    if (model) {
      return model
    }
  }

  if (isProviderEnabled(DEFAULT_MODEL.providerId, cookieStore)) {
    return DEFAULT_MODEL
  }

  return pickFirstFetchedModel(await fetchAvailableModels())
}

export { DEFAULT_MODEL }
