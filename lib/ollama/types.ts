export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details?: {
    format: string
    family: string
    families?: string[]
    parameter_size: string
    quantization_level: string
  }
}

export interface OllamaModelCapabilities {
  name: string
  capabilities: string[]
  contextWindow: number
  parameters: Record<string, any>
  timestamp?: number
}

export interface OllamaModelsResponse {
  models: OllamaModel[]
}

export interface OllamaShowResponse {
  name: string
  capabilities: string[]
  context_window: number
  parameters: Record<string, any>
}
