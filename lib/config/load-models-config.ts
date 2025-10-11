import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'

export interface ModelsConfig {
  version: number
  models: {
    byMode: Record<SearchMode, Record<ModelType, Model>>
    relatedQuestions: Model
  }
}

let cachedConfig: ModelsConfig | null = null
let cachedProfile: string | null = null

const VALID_MODEL_TYPES: ModelType[] = ['speed', 'quality']
const VALID_SEARCH_MODES: SearchMode[] = ['quick', 'adaptive', 'planning']

function resolveConfigPath(): string {
  const profile =
    process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true' ? 'cloud' : 'default'
  const file = `${profile}.json`
  const configPath = path.resolve(process.cwd(), 'config', 'models', file)
  return configPath
}

function validateModelsConfigStructure(
  json: unknown
): asserts json is ModelsConfig {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid models config: not an object')
  }
  const parsed = json as Record<string, any>
  if (typeof parsed.version !== 'number') {
    throw new Error('Invalid models config: missing version')
  }
  if (!parsed.models || typeof parsed.models !== 'object') {
    throw new Error('Invalid models config: missing models')
  }
  if (!parsed.models.byMode || !parsed.models.relatedQuestions) {
    throw new Error('Invalid models config: missing required sections')
  }
  if (typeof parsed.models.byMode !== 'object') {
    throw new Error('Invalid models config: byMode must be an object')
  }
  if (typeof parsed.models.relatedQuestions !== 'object') {
    throw new Error('Invalid models config: relatedQuestions must be an object')
  }

  for (const searchMode of VALID_SEARCH_MODES) {
    const modeEntry = parsed.models.byMode[searchMode]
    if (!modeEntry || typeof modeEntry !== 'object') {
      throw new Error(
        `Invalid models config: missing configuration for mode "${searchMode}"`
      )
    }
    for (const modelType of VALID_MODEL_TYPES) {
      if (!modeEntry[modelType]) {
        throw new Error(
          `Invalid models config: missing definition for mode "${searchMode}" and model type "${modelType}"`
        )
      }
    }
  }
}

export async function loadModelsConfig(): Promise<ModelsConfig> {
  const profile =
    process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true' ? 'cloud' : 'default'

  if (cachedConfig && cachedProfile === profile) {
    return cachedConfig
  }

  const filePath = resolveConfigPath()
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const json = JSON.parse(raw)

    validateModelsConfigStructure(json)

    cachedConfig = json as ModelsConfig
    cachedProfile = profile
    return cachedConfig
  } catch (err) {
    // If selected profile fails, try default as a safe fallback
    if (profile !== 'default') {
      const fallbackPath = path.resolve(
        process.cwd(),
        'config',
        'models',
        'default.json'
      )
      const raw = await fs.readFile(fallbackPath, 'utf-8')
      const json = JSON.parse(raw)
      validateModelsConfigStructure(json)
      cachedConfig = json as ModelsConfig
      cachedProfile = 'default'
      return cachedConfig
    }
    throw err
  }
}

// Synchronous load (for code paths that need sync access)
export function loadModelsConfigSync(): ModelsConfig {
  const profile =
    process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true' ? 'cloud' : 'default'
  if (cachedConfig && cachedProfile === profile) {
    return cachedConfig
  }

  const filePath = resolveConfigPath()
  try {
    const raw = fsSync.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw)
    validateModelsConfigStructure(json)
    cachedConfig = json as ModelsConfig
    cachedProfile = profile
    return cachedConfig
  } catch (err) {
    if (profile !== 'default') {
      const fallbackPath = path.resolve(
        process.cwd(),
        'config',
        'models',
        'default.json'
      )
      const raw = fsSync.readFileSync(fallbackPath, 'utf-8')
      const json = JSON.parse(raw)
      validateModelsConfigStructure(json)
      cachedConfig = json as ModelsConfig
      cachedProfile = 'default'
      return cachedConfig
    }
    throw err
  }
}

// Public accessor that ensures a config is available synchronously
export function getModelsConfig(): ModelsConfig {
  if (!cachedConfig) {
    return loadModelsConfigSync()
  }
  return cachedConfig
}
