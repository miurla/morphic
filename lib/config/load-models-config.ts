import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'

export interface ModelsConfig {
  version: number
  models: {
    types: Record<ModelType, Model>
    relatedQuestions: Model
  }
}

let cachedConfig: ModelsConfig | null = null
let cachedProfile: string | null = null

function resolveConfigPath(): string {
  const profile = process.env.MORPHIC_MODELS_PROFILE?.trim() || 'default'
  const file = `${profile}.json`
  const configPath = path.resolve(process.cwd(), 'config', 'models', file)
  return configPath
}

export async function loadModelsConfig(): Promise<ModelsConfig> {
  const profile = process.env.MORPHIC_MODELS_PROFILE?.trim() || 'default'

  if (cachedConfig && cachedProfile === profile) {
    return cachedConfig
  }

  const filePath = resolveConfigPath()
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const json = JSON.parse(raw)

    // Minimal validation
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid models config: not an object')
    }
    if (typeof json.version !== 'number') {
      throw new Error('Invalid models config: missing version')
    }
    if (!json.models || typeof json.models !== 'object') {
      throw new Error('Invalid models config: missing models')
    }
    if (!json.models.types || !json.models.relatedQuestions) {
      throw new Error('Invalid models config: missing required sections')
    }

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
      cachedConfig = json as ModelsConfig
      cachedProfile = 'default'
      return cachedConfig
    }
    throw err
  }
}

// Synchronous load (for code paths that need sync access)
export function loadModelsConfigSync(): ModelsConfig {
  const profile = process.env.MORPHIC_MODELS_PROFILE?.trim() || 'default'
  if (cachedConfig && cachedProfile === profile) {
    return cachedConfig
  }

  const filePath = resolveConfigPath()
  try {
    const raw = fsSync.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw)
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
