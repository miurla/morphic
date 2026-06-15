export type OllamaCapability =
  | 'chat'
  | 'streaming'
  | 'thinking'
  | 'structuredOutputs'
  | 'vision'
  | 'embeddings'
  | 'toolCalling'
  | 'webSearch'

const EMBEDDING_MODEL_PATTERNS = [
  /embed/i,
  /embedding/i,
  /bge-/i,
  /all-minilm/i,
  /mxbai/i,
  /nomic-embed/i
]

const VISION_MODEL_PATTERNS = [
  /(^|[:/-])gemma3/i,
  /(^|[:/-])gemma4/i,
  /qwen\d*[-.]?vl/i,
  /vision/i,
  /llava/i,
  /bakllava/i,
  /moondream/i,
  /minicpm-v/i
]

const THINKING_MODEL_PATTERNS = [
  /qwen3/i,
  /gpt-oss/i,
  /deepseek-r1/i,
  /deepseek-v3\.[12]/i,
  /kimi-k2-thinking/i,
  /cogito/i,
  /rnj/i
]

const NON_CHAT_MODEL_PATTERNS = [
  /moderation/i,
  /guard/i,
  /rerank/i,
  /tts/i,
  /whisper/i,
  /audio/i,
  /image/i
]

export function inferOllamaModelCapabilities(
  modelId: string,
  providerId: 'ollama' | 'ollama-cloud' = 'ollama'
): OllamaCapability[] {
  const normalized = modelId.toLowerCase()
  const capabilities = new Set<OllamaCapability>()

  if (EMBEDDING_MODEL_PATTERNS.some(pattern => pattern.test(normalized))) {
    capabilities.add('embeddings')
    return Array.from(capabilities)
  }

  capabilities.add('chat')
  capabilities.add('streaming')
  capabilities.add('toolCalling')

  if (THINKING_MODEL_PATTERNS.some(pattern => pattern.test(normalized))) {
    capabilities.add('thinking')
  }

  if (VISION_MODEL_PATTERNS.some(pattern => pattern.test(normalized))) {
    capabilities.add('vision')
  }

  if (providerId === 'ollama') {
    capabilities.add('structuredOutputs')
  }

  if (providerId === 'ollama-cloud') {
    capabilities.add('webSearch')
  }

  return Array.from(capabilities)
}

export function normalizeOllamaApiCapabilities(
  modelId: string,
  providerId: 'ollama' | 'ollama-cloud',
  apiCapabilities?: string[]
): OllamaCapability[] {
  if (!apiCapabilities?.length) {
    return inferOllamaModelCapabilities(modelId, providerId)
  }

  const normalizedCapabilities = new Set(
    apiCapabilities.map(capability => capability.trim().toLowerCase())
  )
  const capabilities = new Set<OllamaCapability>()

  if (
    normalizedCapabilities.has('completion') ||
    normalizedCapabilities.has('chat')
  ) {
    capabilities.add('chat')
    capabilities.add('streaming')
  }

  if (
    normalizedCapabilities.has('tools') ||
    normalizedCapabilities.has('tool') ||
    normalizedCapabilities.has('tool_calling') ||
    normalizedCapabilities.has('tool-calling')
  ) {
    capabilities.add('toolCalling')
  }

  if (normalizedCapabilities.has('thinking')) {
    capabilities.add('thinking')
  }

  if (normalizedCapabilities.has('vision')) {
    capabilities.add('vision')
  }

  if (
    normalizedCapabilities.has('embedding') ||
    normalizedCapabilities.has('embeddings')
  ) {
    capabilities.add('embeddings')
  }

  if (providerId === 'ollama' && capabilities.has('chat')) {
    capabilities.add('structuredOutputs')
  }

  if (providerId === 'ollama-cloud' && capabilities.has('chat')) {
    capabilities.add('webSearch')
  }

  return Array.from(capabilities)
}

export function isOllamaAppChatModel(
  modelId: string,
  providerId: 'ollama' | 'ollama-cloud' = 'ollama',
  apiCapabilities?: string[]
): boolean {
  const normalized = modelId.toLowerCase()
  if (NON_CHAT_MODEL_PATTERNS.some(pattern => pattern.test(normalized))) {
    return false
  }

  const capabilities = normalizeOllamaApiCapabilities(
    modelId,
    providerId,
    apiCapabilities
  )
  return capabilities.includes('chat') && capabilities.includes('toolCalling')
}

export function getOllamaChatSettings(modelId: string): {
  think?: boolean | 'low' | 'medium' | 'high'
} {
  const normalized = modelId.toLowerCase()

  if (!inferOllamaModelCapabilities(modelId).includes('thinking')) {
    return {}
  }

  if (normalized.includes('gpt-oss')) {
    return { think: 'medium' }
  }

  return { think: true }
}
