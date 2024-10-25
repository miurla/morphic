import type { Model } from '@/lib/types/models'

export function createModelIdentifier(model: Model): string {
  return `${model.providerId}:${model.id}`
}

export function getDefaultModelIdentifier(models: Model[]): string {
  if (!models.length) {
    throw new Error('No models available')
  }
  return createModelIdentifier(models[0])
}
