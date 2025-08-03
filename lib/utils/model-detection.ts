import type { Model } from '@/lib/types/models'

/**
 * Check if a model is an Anthropic model
 * @param model - Either a Model object or a model ID string
 * @returns true if the model is from Anthropic provider
 */
export function isAnthropicModel(model: Model | string): boolean {
  if (typeof model === 'string') {
    // Handle model ID string format (e.g., 'anthropic:claude-3-opus')
    return model.startsWith('anthropic:')
  }
  // Handle Model object
  return model.providerId === 'anthropic'
}
