import {
  OllamaModel,
  OllamaModelCapabilities,
  OllamaModelsResponse,
  OllamaShowResponse
} from './types'

export class OllamaClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Get all available models from Ollama instance
   * Uses GET /api/models endpoint for fast model listing
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        )
      }

      const data: OllamaModelsResponse = await response.json()
      return data.models || []
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      throw error
    }
  }

  /**
   * Get detailed model capabilities from Ollama instance
   * Uses POST /api/show endpoint for detailed model information
   */
  async getModelCapabilities(
    modelName: string
  ): Promise<OllamaModelCapabilities> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      })

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        )
      }

      const data: OllamaShowResponse = await response.json()
      return {
        name: data.name,
        capabilities: data.capabilities || [],
        contextWindow: data.context_window || 128_000,
        parameters: data.parameters || {}
      }
    } catch (error) {
      console.error(`Failed to get capabilities for ${modelName}:`, error)
      throw error
    }
  }

  /**
   * Check if Ollama instance is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'HEAD',
        cache: 'no-store'
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}
