import { loadModelsConfig } from '@/lib/config/load-models-config'
import { OllamaClient } from '@/lib/ollama/client'
import { Model } from '@/lib/types/models'

/**
 * Memory cache for validated Ollama models
 * Stored in server memory (only suitable for local deployments)
 */
let validatedModels: Set<string> | null = null
let validationError: Error | null = null

/**
 * Extract all Ollama models from the configuration
 */
async function getConfiguredOllamaModels(): Promise<Model[]> {
  const ollamaModels: Model[] = []

  try {
    const config = await loadModelsConfig()

    // Check byMode models
    for (const mode of Object.values(config.models.byMode)) {
      for (const model of Object.values(mode as Record<string, Model>)) {
        if (model.providerId === 'ollama') {
          ollamaModels.push(model)
        }
      }
    }

    // Check relatedQuestions model
    if (config.models.relatedQuestions?.providerId === 'ollama') {
      ollamaModels.push(config.models.relatedQuestions)
    }
  } catch (error) {
    console.warn('Failed to load model configuration:', error)
  }

  return ollamaModels
}

/**
 * Initialize Ollama model validation on server startup
 * Checks which models support 'tools' capability required for Morphic
 * Also validates that configured Ollama models support tools
 */
export async function initializeOllamaValidation(): Promise<void> {
  // Skip validation if OLLAMA_BASE_URL is not configured
  if (!process.env.OLLAMA_BASE_URL) {
    console.log('Ollama validation skipped (OLLAMA_BASE_URL not configured)')
    return
  }

  try {
    console.log(
      `Starting Ollama model validation at ${process.env.OLLAMA_BASE_URL}`
    )

    const client = new OllamaClient(process.env.OLLAMA_BASE_URL)

    // Check if Ollama is available
    const isAvailable = await client.isAvailable()
    if (!isAvailable) {
      console.warn(
        'Ollama instance is not available. Models will not be validated.'
      )
      return
    }

    // Get all available models
    const models = await client.getModels()
    console.log(`Found ${models.length} Ollama models`)

    // Validate each model for tools capability
    const validated = new Set<string>()
    for (const model of models) {
      try {
        const capabilities = await client.getModelCapabilities(model.name)
        if (capabilities.capabilities.includes('tools')) {
          validated.add(model.name)
          console.log(`✓ ${model.name} supports tools`)
        } else {
          console.log(`✗ ${model.name} does not support tools (skipped)`)
        }
      } catch (err) {
        console.warn(`Failed to check capabilities for ${model.name}:`, err)
        continue
      }
    }

    validatedModels = validated
    console.log(
      `Ollama validation complete: ${validated.size} models with tools support`
    )

    // Check configured models against validated models
    try {
      const configuredOllamaModels = await getConfiguredOllamaModels()

      if (configuredOllamaModels.length > 0) {
        console.log(
          `\nValidating ${configuredOllamaModels.length} configured Ollama model(s)...`
        )

        const invalidModels: string[] = []
        for (const model of configuredOllamaModels) {
          if (!validated.has(model.id)) {
            invalidModels.push(model.id)
            console.error(`✗ ${model.id} (configured but lacks tools support)`)
          } else {
            console.log(`✓ ${model.id} (configured and tools supported)`)
          }
        }

        if (invalidModels.length > 0) {
          console.error(
            '\n⚠️  ERROR: Configured Ollama models do not support tools!\n' +
              `The following model(s) in your config/models/*.json do not support tools capability:\n` +
              invalidModels.map(m => `  - ${m}`).join('\n') +
              '\n\nMorphic requires models with tools capability for web search functionality.\n' +
              'Please update your configuration to use models with tools support, for example:\n' +
              '  ollama pull qwen3\n' +
              '  ollama pull gpt-oss\n' +
              '  ollama pull deepseek-v3.1\n'
          )
        }
      }
    } catch (configError) {
      console.warn('Failed to validate configured models:', configError)
    }

    // Error if no models support tools at all
    if (validated.size === 0) {
      console.error(
        '\n⚠️  ERROR: No Ollama models with tools support found!\n' +
          'Morphic requires models with tools capability for web search functionality.\n' +
          'Please install a model with tools support, for example:\n' +
          '  ollama pull qwen3\n' +
          '  ollama pull gpt-oss\n' +
          '  ollama pull deepseek-v3.1\n' +
          'Models without tools support will not work with Morphic.\n'
      )
    }
  } catch (error) {
    validationError = error as Error
    console.error('Ollama validation failed:', error)
    console.warn('Morphic will continue, but Ollama models may not work')
  }
}

/**
 * Validate if a specific Ollama model supports tools capability
 * Returns validation result with optional error message
 */
export function validateOllamaModel(modelId: string): {
  valid: boolean
  error?: string
} {
  // If OLLAMA_BASE_URL is not configured, consider model valid (not using Ollama)
  if (!process.env.OLLAMA_BASE_URL) {
    return { valid: true }
  }

  // If validation hasn't run yet (shouldn't happen after startup), consider valid
  if (validatedModels === null && validationError === null) {
    return { valid: true }
  }

  // If validation failed, warn but allow the model to be used
  if (validationError) {
    return {
      valid: true,
      error: `Ollama validation failed: ${validationError.message}. Model may not work correctly.`
    }
  }

  // Check actual validation results
  if (!validatedModels!.has(modelId)) {
    return {
      valid: false,
      error: `Model "${modelId}" does not support tools capability required for Morphic. Please use a model with tools support.`
    }
  }

  return { valid: true }
}

/**
 * Get list of all validated Ollama models with tools support
 */
export function getValidatedOllamaModels(): string[] {
  if (!validatedModels) {
    return []
  }
  return Array.from(validatedModels)
}
