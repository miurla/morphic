export interface Model {
  id: string
  name: string
  provider: string
  providerId: string
  enabled: boolean
  toolCallType: 'native' | 'manual'
  toolCallModel?: string
  // Ollama-specific fields (only added when needed)
  capabilities?: string[]
  contextWindow?: number
}
