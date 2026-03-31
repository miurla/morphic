import { cookies } from 'next/headers'

import { DEFAULT_MODEL } from '@/lib/config/default-model'
import {
  MODEL_SELECTION_COOKIE,
  parseModelSelectionCookie
} from '@/lib/config/model-selection-cookie'
import { fetchAvailableModels } from '@/lib/models/fetch-models'
import { ModelSelectorData } from '@/lib/types/model-selector'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'

import 'server-only'

function modelKey(model: Model): string {
  return `${model.providerId}:${model.id}`
}

function pickFirstAvailableModel(
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

function resolveSelectedModelKey(
  modelsByProvider: Record<string, Model[]>,
  fallbackModel: Model | null,
  cookieValue?: string
): string {
  const parsedCookie = parseModelSelectionCookie(cookieValue)
  if (!parsedCookie) {
    return fallbackModel ? modelKey(fallbackModel) : ''
  }

  const matched = Object.values(modelsByProvider)
    .flat()
    .some(
      model =>
        model.providerId === parsedCookie.providerId &&
        model.id === parsedCookie.modelId
    )

  return matched
    ? `${parsedCookie.providerId}:${parsedCookie.modelId}`
    : fallbackModel
      ? modelKey(fallbackModel)
      : ''
}

export async function getModelSelectorData(): Promise<ModelSelectorData> {
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true') {
    return {
      enabled: false,
      modelsByProvider: {},
      selectedModelKey: '',
      hasAvailableModels: false
    }
  }

  const modelsByProvider = await fetchAvailableModels()
  const fallbackModel = pickFirstAvailableModel(modelsByProvider)
  const hasAvailableModels =
    fallbackModel !== null || isProviderEnabled(DEFAULT_MODEL.providerId)
  const cookieStore = await cookies()
  const selectedModelKey = resolveSelectedModelKey(
    modelsByProvider,
    fallbackModel,
    cookieStore.get(MODEL_SELECTION_COOKIE)?.value
  )

  return {
    enabled: true,
    modelsByProvider,
    selectedModelKey,
    hasAvailableModels
  }
}
