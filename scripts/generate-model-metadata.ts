import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const API_URL = 'https://models.dev/api.json'
const SNAPSHOT_PROVIDERS = ['anthropic', 'google', 'openai', 'vercel', 'xai']
interface ModelsDevModel {
  id?: string
  limit?: {
    context?: number
    input?: number
    output?: number
  }
}

interface ModelsDevProvider {
  models?: Record<string, ModelsDevModel>
}

interface ModelLimit {
  context: number
  output: number
  input?: number
}

type ModelsDevData = Record<string, ModelsDevProvider>
type ModelMetadata = Record<string, Record<string, ModelLimit>>

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined

  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`)
  }

  return value
}

async function readSource(source?: string): Promise<ModelsDevData> {
  if (source) {
    return JSON.parse(await readFile(source, 'utf8'))
  }

  const response = await fetch(API_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${API_URL}: ${response.status}`)
  }

  return response.json()
}

function createSnapshot(data: ModelsDevData): ModelMetadata {
  return Object.fromEntries(
    SNAPSHOT_PROVIDERS.map(providerId => {
      const models = data[providerId]?.models
      if (!models) {
        throw new Error(`Missing provider in models.dev data: ${providerId}`)
      }

      const limits = Object.values(models)
        .filter(
          (
            model
          ): model is ModelsDevModel & {
            id: string
            limit: { context: number; output: number; input?: number }
          } =>
            typeof model.id === 'string' &&
            typeof model.limit?.context === 'number' &&
            typeof model.limit.output === 'number'
        )
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(model => [
          model.id,
          {
            context: model.limit.context,
            ...(typeof model.limit.input === 'number'
              ? { input: model.limit.input }
              : {}),
            output: model.limit.output
          }
        ])

      return [providerId, Object.fromEntries(limits)]
    })
  )
}

async function main(): Promise<void> {
  const root = process.cwd()
  const source = getArgument('--source')
  const data = await readSource(source)
  const snapshot = createSnapshot(data)
  const outputPath = path.join(root, 'lib/config/model-metadata.json')

  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`)
}

await main()
