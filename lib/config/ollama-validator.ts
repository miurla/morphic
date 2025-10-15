import { OllamaClient } from '@/lib/ollama/client'

/**
 * Memory cache for validated Ollama models
 * Stored in server memory (only suitable for local deployments)
 */
let validatedModels: Set<string> | null = null
let validationError: Error | null = null

/**
 * Initialize Ollama model validation on server startup
 * Checks which models support 'tools' capability required for Morphic
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

    // Error if no models support tools
    if (validated.size === 0) {
      console.error(
        '\n⚠️  ERROR: No Ollama models with tools support found!\n' +
          'Morphic requires models with tools capability for web search functionality.\n' +
          'Please install a model with tools support, for example:\n' +
          '  ollama pull llama3.2\n' +
          '  ollama pull qwen2.5\n' +
          '  ollama pull mistral\n' +
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
