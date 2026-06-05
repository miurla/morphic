import { cookies } from 'next/headers'

import { createGateway } from '@ai-sdk/gateway'

import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'

import { isSearchCompatibleModel } from './compatibility'

export type ModelsByProvider = Record<string, Model[]>

const MODEL_CACHE_TTL_MS = 2 * 60 * 1000
const DATE_SNAPSHOT_SUFFIX_REGEX = /-\d{4}-\d{2}-\d{2}$/
const GOOGLE_PREVIEW_SNAPSHOT_REGEX = /preview-\d{2}-\d{2,4}$/i
const OPENAI_ALLOWED_PREFIXES = ['gpt-5', 'o1', 'o3', 'o4']
const OPENAI_EXCLUDED_KEYWORDS = [
  'embed',
  'tts',
  'whisper',
  'dall-e',
  'davinci',
  'babbage',
  'ft:',
  'image',
  'audio',
  'realtime',
  'codex',
  'search',
  'transcribe',
  'deep-research',
  'oss',
  'instruct',
  'chat-latest'
]
const ANTHROPIC_ALLOWED_PREFIXES = [
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-haiku-4'
]
const GOOGLE_ALLOWED_PREFIXES = ['gemini-2.5', 'gemini-3']
const GOOGLE_EXCLUDED_KEYWORDS = ['image', 'live', 'native-audio', 'embedding']
const OPENAI_COMPATIBLE_EXCLUDED_KEYWORDS = [
  'embed',
  'tts',
  'whisper',
  'audio',
  'transcribe',
  'image',
  'realtime',
  'rerank'
]

let modelsCache:
  | {
      expiresAt: number
      value: ModelsByProvider
    }
  | undefined

function sortModels(models: Model[]): Model[] {
  return [...models].sort((a, b) => a.name.localeCompare(b.name))
}

function dedupeModels(models: Model[]): Model[] {
  const seen = new Set<string>()
  const deduped: Model[] = []

  for (const model of models) {
    const key = `${model.provider}|${model.providerId}|${model.id}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(model)
  }

  return deduped
}

function groupByProvider(models: Model[]): ModelsByProvider {
  return models.reduce<ModelsByProvider>((acc, model) => {
    const key = model.provider
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(model)
    return acc
  }, {})
}

function hasDateSnapshotSuffix(modelId: string): boolean {
  return DATE_SNAPSHOT_SUFFIX_REGEX.test(modelId)
}

function passesOpenAIFilters(id: string): boolean {
  if (hasDateSnapshotSuffix(id)) {
    return false
  }

  if (!OPENAI_ALLOWED_PREFIXES.some(prefix => id.startsWith(prefix))) {
    return false
  }

  return !OPENAI_EXCLUDED_KEYWORDS.some(keyword =>
    id.toLowerCase().includes(keyword)
  )
}

function passesAnthropicFilters(id: string): boolean {
  if (hasDateSnapshotSuffix(id)) {
    return false
  }

  return ANTHROPIC_ALLOWED_PREFIXES.some(prefix => id.startsWith(prefix))
}

function passesGoogleFilters(id: string): boolean {
  if (hasDateSnapshotSuffix(id)) {
    return false
  }

  if (GOOGLE_PREVIEW_SNAPSHOT_REGEX.test(id)) {
    return false
  }

  if (!GOOGLE_ALLOWED_PREFIXES.some(prefix => id.startsWith(prefix))) {
    return false
  }

  return !GOOGLE_EXCLUDED_KEYWORDS.some(keyword =>
    id.toLowerCase().includes(keyword)
  )
}

function passesOpenAICompatibleFilters(id: string): boolean {
  return !OPENAI_COMPATIBLE_EXCLUDED_KEYWORDS.some(keyword =>
    id.toLowerCase().includes(keyword)
  )
}

function formatProviderModelName(id: string): string {
  const modelId = id.includes('/') ? id.split('/').pop() || id : id
  return modelId
    .replace(/-latest$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function modelsFromStaticList(
  staticList: string,
  provider: string,
  providerId: string,
  isCompatible: (id: string) => boolean = id =>
    passesOpenAICompatibleFilters(id) && isSearchCompatibleModel(providerId, id)
): Model[] {
  return sortModels(
    dedupeModels(
      staticList
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .filter(isCompatible)
        .map(id => ({
          id,
          name: formatProviderModelName(id),
          provider,
          providerId
        }))
    )
  )
}

function passesGatewayFilters(id: string): boolean {
  if (hasDateSnapshotSuffix(id)) {
    return false
  }

  const separatorIndex = id.indexOf('/')
  if (separatorIndex <= 0) {
    return true
  }

  const provider = id.slice(0, separatorIndex)
  const modelId = id.slice(separatorIndex + 1)
  if (!modelId) {
    return false
  }

  switch (provider) {
    case 'openai':
      return passesOpenAIFilters(modelId)
    case 'anthropic':
      return passesAnthropicFilters(modelId)
    case 'google':
      return passesGoogleFilters(modelId)
    default:
      return true
  }
}

async function fetchJson(
  url: string,
  headers: HeadersInit
): Promise<Record<string, any>> {
  const response = await fetch(url, { headers, method: 'GET' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return (await response.json()) as Record<string, any>
}

export async function fetchOpenAIModels(): Promise<Model[]> {
  if (!isProviderEnabled('openai')) {
    return []
  }

  try {
    const json = await fetchJson('https://api.openai.com/v1/models', {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    })

    const data = Array.isArray(json?.data) ? json.data : []
    return sortModels(
      dedupeModels(
        data
          .map(item => String(item?.id ?? ''))
          .filter(Boolean)
          .filter(passesOpenAIFilters)
          .map(id => ({
            id,
            name: id,
            provider: 'OpenAI',
            providerId: 'openai'
          }))
      )
    )
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch OpenAI models:', error)
    return []
  }
}

export async function fetchAnthropicModels(): Promise<Model[]> {
  if (!isProviderEnabled('anthropic')) {
    return []
  }

  try {
    const models: Model[] = []
    const baseUrl = 'https://api.anthropic.com/v1/models'
    let afterId: string | undefined
    let hasMore = true

    while (hasMore) {
      const url = new URL(baseUrl)
      url.searchParams.set('limit', '100')
      if (afterId) {
        url.searchParams.set('after_id', afterId)
      }

      const json = await fetchJson(url.toString(), {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      })

      const data = Array.isArray(json?.data) ? json.data : []
      models.push(
        ...data
          .map(item => {
            const id = String(item?.id ?? '')
            if (!id) return null
            return {
              id,
              name: String(item?.display_name ?? id),
              provider: 'Anthropic',
              providerId: 'anthropic'
            } satisfies Model
          })
          .filter((model): model is Model => model !== null)
          .filter(model => passesAnthropicFilters(model.id))
      )

      hasMore = Boolean(json?.has_more)
      afterId = typeof json?.last_id === 'string' ? json.last_id : undefined

      if (!hasMore || !afterId) {
        break
      }
    }

    return sortModels(dedupeModels(models))
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch Anthropic models:', error)
    return []
  }
}

export async function fetchGoogleModels(): Promise<Model[]> {
  if (!isProviderEnabled('google')) {
    return []
  }

  try {
    const models: Model[] = []
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    let nextPageToken: string | undefined
    while (true) {
      const url = new URL(
        'https://generativelanguage.googleapis.com/v1beta/models'
      )
      url.searchParams.set('key', apiKey!)
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken)
      }

      const json = await fetchJson(url.toString(), {})
      const data = Array.isArray(json?.models) ? json.models : []

      models.push(
        ...data
          .filter(item =>
            Array.isArray(item?.supportedGenerationMethods)
              ? item.supportedGenerationMethods.includes('generateContent')
              : false
          )
          .map(item => {
            const rawName = String(item?.name ?? '')
            const id = rawName.startsWith('models/')
              ? rawName.slice('models/'.length)
              : rawName
            if (!id) return null
            return {
              id,
              name: String(item?.displayName ?? id),
              provider: 'Google',
              providerId: 'google'
            } satisfies Model
          })
          .filter((model): model is Model => model !== null)
          .filter(model => passesGoogleFilters(model.id))
      )

      nextPageToken =
        typeof json?.nextPageToken === 'string' ? json.nextPageToken : undefined
      if (!nextPageToken) {
        break
      }
    }

    return sortModels(dedupeModels(models))
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch Google models:', error)
    return []
  }
}

export async function fetchOpenAICompatibleModels(): Promise<Model[]> {
  if (!isProviderEnabled('openai-compatible')) {
    return []
  }

  const providerName =
    process.env.OPENAI_COMPATIBLE_PROVIDER_NAME || 'OpenAI Compatible'

  // Static-list path: when OPENAI_COMPATIBLE_MODELS is set, skip the
  // network call and trust the comma-separated list. Useful when the
  // provider has no /v1/models endpoint, or when that endpoint is
  // slow / unreachable.
  const staticList = process.env.OPENAI_COMPATIBLE_MODELS
  if (staticList) {
    return modelsFromStaticList(staticList, providerName, 'openai-compatible')
  }

  try {
    const rawBaseURL = process.env.OPENAI_COMPATIBLE_API_BASE_URL || ''
    if (!rawBaseURL) {
      return []
    }
    const baseURL = rawBaseURL.replace(/\/+$/, '').replace(/\/v1$/, '')

    const json = await fetchJson(`${baseURL}/v1/models`, {
      Authorization: `Bearer ${process.env.OPENAI_COMPATIBLE_API_KEY}`
    })

    const data = Array.isArray(json?.data) ? json.data : []
    return sortModels(
      dedupeModels(
        data
          .map(item => String(item?.id ?? ''))
          .filter(Boolean)
          .filter(passesOpenAICompatibleFilters)
          .map(id => ({
            id,
            name: id,
            provider: providerName,
            providerId: 'openai-compatible'
          }))
      )
    )
  } catch (error) {
    console.warn(
      '[ModelFetch] Failed to fetch OpenAI-compatible models:',
      error
    )
    return []
  }
}

export async function fetchNvidiaModels(): Promise<Model[]> {
  if (!isProviderEnabled('nvidia')) {
    return []
  }

  const fallbackModels = modelsFromStaticList(
    [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct'
    ].join(','),
    'NVIDIA NIM',
    'nvidia'
  )

  const staticList = process.env.NVIDIA_MODELS
  if (staticList) {
    return modelsFromStaticList(staticList, 'NVIDIA NIM', 'nvidia')
  }

  try {
    const rawBaseURL =
      process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com'
    const baseURL = rawBaseURL.replace(/\/+$/, '').replace(/\/v1$/, '')

    const json = await fetchJson(`${baseURL}/v1/models`, {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`
    })

    const data = Array.isArray(json?.data) ? json.data : []
    const models = sortModels(
      dedupeModels(
        data
          .map(item => String(item?.id ?? ''))
          .filter(Boolean)
          .filter(passesOpenAICompatibleFilters)
          .filter(id => isSearchCompatibleModel('nvidia', id))
          .map(id => ({
            id,
            name: formatProviderModelName(id),
            provider: 'NVIDIA NIM',
            providerId: 'nvidia'
          }))
      )
    )

    return models.length > 0 ? models : fallbackModels
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch NVIDIA NIM models:', error)
    return fallbackModels
  }
}

export async function fetchOllamaModels(): Promise<Model[]> {
  if (!isProviderEnabled('ollama')) {
    return []
  }

  try {
    const baseUrl = process.env.OLLAMA_BASE_URL
    const url = new URL('/api/tags', baseUrl).toString()
    const json = await fetchJson(url, {})
    const data = Array.isArray(json?.models) ? json.models : []

    return sortModels(
      dedupeModels(
        data
          .map(item => String(item?.name ?? ''))
          .filter(Boolean)
          .filter(name => !name.toLowerCase().includes('embed'))
          .map(
            name =>
              ({
                id: name,
                name,
                provider: 'Ollama',
                providerId: 'ollama',
                providerOptions: {
                  ollama: {
                    think: true
                  }
                }
              }) satisfies Model
          )
      )
    )
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch Ollama models:', error)
    return []
  }
}

export async function fetchGatewayModels(): Promise<Model[]> {
  if (!isProviderEnabled('gateway')) {
    return []
  }

  try {
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY
    })

    const metadata = await gateway.getAvailableModels()
    const availableModels = metadata.models ?? []

    return sortModels(
      dedupeModels(
        availableModels
          .filter(model => model?.modelType === 'language')
          .map(model => {
            const id = String(model?.id ?? '')
            if (!id) return null
            return {
              id,
              name: String(model?.name ?? id),
              provider: 'Gateway',
              providerId: 'gateway'
            } satisfies Model
          })
          .filter((model): model is Model => model !== null)
          .filter(model => passesGatewayFilters(model.id))
      )
    )
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch Gateway models:', error)
    return []
  }
}

export async function fetchMistralModels(): Promise<Model[]> {
  if (!isProviderEnabled('mistral')) {
    return []
  }

  const fallbacks = [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      provider: 'Mistral',
      providerId: 'mistral'
    },
    {
      id: 'mistral-medium-latest',
      name: 'Mistral Medium',
      provider: 'Mistral',
      providerId: 'mistral'
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      provider: 'Mistral',
      providerId: 'mistral'
    },
    {
      id: 'codestral-latest',
      name: 'Codestral',
      provider: 'Mistral',
      providerId: 'mistral'
    }
  ]

  try {
    const json = await fetchJson('https://api.mistral.ai/v1/models', {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
    })

    const data = Array.isArray(json?.data) ? json.data : []
    if (data.length === 0) {
      return fallbacks
    }

    const excluded = ['embed', 'moderation', 'ocr']

    return data
      .map((m: Record<string, unknown>) => String(m?.id ?? ''))
      .filter(Boolean)
      .filter(
        (id: string) => !excluded.some(kw => id.toLowerCase().includes(kw))
      )
      .map((id: string) => ({
        id,
        name: id
          .replace(/-latest$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()),
        provider: 'Mistral',
        providerId: 'mistral'
      }))
  } catch (error) {
    console.error('Error fetching Mistral models:', error)
    return fallbacks
  }
}
export async function fetchCloudflareModels(): Promise<Model[]> {
  if (!isProviderEnabled('cloudflare')) {
    return []
  }

  const fallbacks = [
    {
      id: '@cf/meta/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'Cloudflare',
      providerId: 'cloudflare'
    },
    {
      id: '@cf/meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B Instruct',
      provider: 'Cloudflare',
      providerId: 'cloudflare'
    },
    {
      id: '@cf/meta/llama-3.2-3b-instruct',
      name: 'Llama 3.2 3B Instruct',
      provider: 'Cloudflare',
      providerId: 'cloudflare'
    },
    {
      id: '@cf/qwen/qwen1.5-14b-chat-awq',
      name: 'Qwen 1.5 14B Chat AWQ',
      provider: 'Cloudflare',
      providerId: 'cloudflare'
    }
  ]

  try {
    const json = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/models`,
      {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`
      }
    )

    const data = Array.isArray(json?.result)
      ? json.result
      : Array.isArray(json?.data)
        ? json.data
        : []
    if (data.length === 0) {
      return fallbacks
    }

    const fetchedModels = data
      .map(item => String(item?.id ?? ''))
      .filter(Boolean)
      .filter(
        id =>
          id.startsWith('@cf/') &&
          (id.includes('llama') ||
            id.includes('mistral') ||
            id.includes('qwen') ||
            id.includes('gemma') ||
            id.includes('phi') ||
            id.includes('deepseek'))
      )
      .map(id => ({
        id,
        name: id.split('/').pop() || id,
        provider: 'Cloudflare',
        providerId: 'cloudflare'
      }))

    return fetchedModels.length > 0
      ? sortModels(dedupeModels(fetchedModels))
      : fallbacks
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch Cloudflare models:', error)
    return fallbacks
  }
}

export async function fetchOpenRouterModels(): Promise<Model[]> {
  let cookieStore: any
  try {
    cookieStore = await cookies()
  } catch (e) {}

  if (!isProviderEnabled('openrouter', cookieStore)) {
    return []
  }

  const fallbacks: Model[] = [
    {
      id: 'google/gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'OpenRouter',
      providerId: 'openrouter'
    },
    {
      id: 'google/gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'OpenRouter',
      providerId: 'openrouter'
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'OpenRouter',
      providerId: 'openrouter'
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'OpenRouter',
      providerId: 'openrouter'
    }
  ]

  const staticList = process.env.OPENROUTER_MODELS
  if (staticList) {
    return modelsFromStaticList(staticList, 'OpenRouter', 'openrouter')
  }

  const userKey = cookieStore?.get('openrouter_api_key')?.value
  const apiKey = userKey || process.env.OPENROUTER_API_KEY

  try {
    const json = await fetchJson('https://openrouter.ai/api/v1/models', {
      Authorization: `Bearer ${apiKey}`
    })

    const data = Array.isArray(json?.data) ? json.data : []
    if (data.length === 0) {
      return fallbacks
    }

    const fetchedModels = data
      .map(item => ({
        id: String(item?.id ?? ''),
        name: String(item?.name ?? '')
      }))
      .filter(
        item =>
          item.id &&
          passesOpenAICompatibleFilters(item.id) &&
          !item.id.toLowerCase().includes('moderation') &&
          !item.id.toLowerCase().includes('guard')
      )
      .map(item => ({
        id: item.id,
        name: item.name || formatProviderModelName(item.id),
        provider: 'OpenRouter',
        providerId: 'openrouter'
      }))

    return fetchedModels.length > 0
      ? sortModels(dedupeModels(fetchedModels))
      : fallbacks
  } catch (error) {
    console.warn('[ModelFetch] Failed to fetch OpenRouter models:', error)
    return fallbacks
  }
}

export async function fetchAvailableModels(options?: {
  forceRefresh?: boolean
}): Promise<ModelsByProvider> {
  const forceRefresh = options?.forceRefresh === true
  const now = Date.now()

  if (!forceRefresh && modelsCache && modelsCache.expiresAt > now) {
    return modelsCache.value
  }

  const [
    openai,
    anthropic,
    google,
    openaiCompatible,
    nvidia,
    ollama,
    gateway,
    cloudflare,
    mistralModels,
    openrouterModels
  ] = await Promise.all([
    fetchOpenAIModels(),
    fetchAnthropicModels(),
    fetchGoogleModels(),
    fetchOpenAICompatibleModels(),
    fetchNvidiaModels(),
    fetchOllamaModels(),
    fetchGatewayModels(),
    fetchCloudflareModels(),
    fetchMistralModels(),
    fetchOpenRouterModels()
  ])

  const grouped = groupByProvider(
    dedupeModels([
      ...openai,
      ...anthropic,
      ...google,
      ...openaiCompatible,
      ...nvidia,
      ...ollama,
      ...gateway,
      ...cloudflare,
      ...mistralModels,
      ...openrouterModels
    ])
  )

  // Keep stable ordering for each provider list.
  const normalized = Object.fromEntries(
    Object.entries(grouped).map(([provider, models]) => [
      provider,
      sortModels(models)
    ])
  )

  modelsCache = {
    value: normalized,
    expiresAt: now + MODEL_CACHE_TTL_MS
  }

  return normalized
}
