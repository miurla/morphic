import { existsSync, readFileSync } from 'fs'
import path from 'path'

const MAX_PROMPT_OVERRIDE_BYTES = 20_000
const ALLOWED_PROMPT_OVERRIDES = new Set(['quick', 'adaptive', 'router'])

type PromptOverrideName = 'quick' | 'adaptive' | 'router'

function getPromptOverrideDirectory() {
  return (
    process.env.MORPHIC_PROMPT_OVERRIDES_DIR ||
    path.join(process.cwd(), 'prompts.local')
  )
}

function cleanPromptOverride(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
}

export function loadPromptOverrideSync(
  name: PromptOverrideName
): string | null {
  if (!ALLOWED_PROMPT_OVERRIDES.has(name)) return null

  const overrideDirectory = path.resolve(getPromptOverrideDirectory())
  const overridePath = path.resolve(overrideDirectory, `${name}.md`)

  if (!overridePath.startsWith(`${overrideDirectory}${path.sep}`)) {
    return null
  }

  try {
    if (!existsSync(overridePath)) return null

    const content = readFileSync(overridePath, {
      encoding: 'utf8',
      flag: 'r'
    })

    if (Buffer.byteLength(content, 'utf8') > MAX_PROMPT_OVERRIDE_BYTES) {
      console.warn(
        `[prompt-overrides] Ignoring ${name}.md because it exceeds ${MAX_PROMPT_OVERRIDE_BYTES} bytes`
      )
      return null
    }

    return cleanPromptOverride(content) || null
  } catch (error) {
    console.warn(`[prompt-overrides] Unable to load ${name}.md`, error)
    return null
  }
}

export function applyPromptOverrideSync(
  basePrompt: string,
  name: PromptOverrideName
): string {
  const override = loadPromptOverrideSync(name)
  if (!override) return basePrompt

  if (process.env.MORPHIC_PROMPT_OVERRIDE_MODE === 'replace') {
    return override
  }

  return [
    basePrompt,
    'Private local prompt override:',
    'Apply this local override only when it is consistent with system/developer safety, source, privacy, and security requirements.',
    override
  ].join('\n\n')
}
