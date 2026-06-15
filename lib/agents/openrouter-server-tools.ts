import { z } from 'zod'

export const OPENROUTER_SERVER_TOOLS_HEADER =
  'x-morphic-openrouter-server-tools'

const MODEL_ID_SCHEMA = z.string().trim().min(1).max(200)
const LIMITED_TEXT_SCHEMA = z.string().trim().min(1).max(2000)

const fusionConfigSchema = z
  .object({
    analysisModels: z.array(MODEL_ID_SCHEMA).min(1).max(8).optional(),
    model: MODEL_ID_SCHEMA.optional(),
    maxToolCalls: z.number().int().min(1).max(16).optional(),
    maxCompletionTokens: z.number().int().min(128).max(32_000).optional(),
    reasoning: z
      .object({
        effort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
        maxTokens: z.number().int().min(128).max(32_000).optional()
      })
      .strict()
      .optional(),
    temperature: z.number().min(0).max(2).optional()
  })
  .strict()

const advisorConfigSchema = z
  .object({
    model: MODEL_ID_SCHEMA.optional(),
    advisors: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            model: MODEL_ID_SCHEMA.optional(),
            instructions: LIMITED_TEXT_SCHEMA.optional()
          })
          .strict()
      )
      .max(8)
      .optional(),
    instructions: LIMITED_TEXT_SCHEMA.optional(),
    tools: z
      .array(z.enum(['web_search']))
      .max(4)
      .optional(),
    forwardTranscript: z.boolean().optional(),
    maxToolCalls: z.number().int().min(1).max(16).optional(),
    maxCompletionTokens: z.number().int().min(128).max(32_000).optional(),
    reasoning: z
      .object({
        effort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
        maxTokens: z.number().int().min(128).max(32_000).optional()
      })
      .strict()
      .optional(),
    temperature: z.number().min(0).max(2).optional()
  })
  .strict()

const serverToolsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    tools: z
      .array(z.enum(['fusion', 'advisor']))
      .min(1)
      .max(2)
      .optional(),
    fusion: fusionConfigSchema.optional(),
    advisor: advisorConfigSchema.optional(),
    forceToolChoiceRequired: z.boolean().optional()
  })
  .strict()

export type OpenRouterServerToolsConfig = z.infer<
  typeof serverToolsConfigSchema
>

type OpenRouterProviderOptions = {
  openrouter?: {
    serverTools?: OpenRouterServerToolsConfig
  }
}

function encodeHeader(value: OpenRouterServerToolsConfig): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env[name] ?? '')
      .trim()
      .toLowerCase()
  )
}

function envBool(name: string): boolean | undefined {
  const value = process.env[name]
  if (!value) return undefined

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

function envList(name: string): string[] | undefined {
  const value = process.env[name]
  if (!value) return undefined

  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function envInt(name: string): number | undefined {
  const value = process.env[name]
  if (!value) return undefined

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function envFloat(name: string): number | undefined {
  const value = process.env[name]
  if (!value) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T
}

export function decodeOpenRouterServerToolsHeader(
  value: string
): OpenRouterServerToolsConfig | null {
  try {
    return sanitizeOpenRouterServerToolsConfig(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    )
  } catch {
    return null
  }
}

export function sanitizeOpenRouterServerToolsConfig(
  value: unknown
): OpenRouterServerToolsConfig | null {
  const parsed = serverToolsConfigSchema.safeParse(value)
  if (!parsed.success || parsed.data.enabled !== true) {
    return null
  }

  const tools = parsed.data.tools ?? []
  if (tools.length === 0) {
    return null
  }

  const uniqueTools = Array.from(new Set(tools))
  if (
    uniqueTools.includes('fusion') &&
    !parsed.data.fusion?.analysisModels?.length &&
    !parsed.data.fusion?.model
  ) {
    return null
  }

  if (uniqueTools.includes('advisor') && !parsed.data.advisor?.model) {
    return null
  }

  return {
    ...parsed.data,
    tools: uniqueTools
  }
}

export function createOpenRouterServerToolsProviderOptions(
  config: OpenRouterServerToolsConfig
): OpenRouterProviderOptions {
  const sanitized = sanitizeOpenRouterServerToolsConfig(config)
  return sanitized ? { openrouter: { serverTools: sanitized } } : {}
}

export function createOpenRouterServerToolsProviderOptionsFromEnv(): OpenRouterProviderOptions {
  if (!envFlag('OPENROUTER_SERVER_TOOLS_ENABLED')) {
    return {}
  }

  const tools = envList('OPENROUTER_SERVER_TOOLS') as
    | OpenRouterServerToolsConfig['tools']
    | undefined

  return createOpenRouterServerToolsProviderOptions({
    enabled: true,
    tools,
    fusion: pruneUndefined({
      analysisModels: envList('OPENROUTER_FUSION_ANALYSIS_MODELS'),
      model: process.env.OPENROUTER_FUSION_JUDGE_MODEL,
      maxToolCalls: envInt('OPENROUTER_FUSION_MAX_TOOL_CALLS'),
      maxCompletionTokens: envInt('OPENROUTER_FUSION_MAX_COMPLETION_TOKENS'),
      temperature: envFloat('OPENROUTER_FUSION_TEMPERATURE')
    }),
    advisor: pruneUndefined({
      model: process.env.OPENROUTER_ADVISOR_MODEL,
      instructions: process.env.OPENROUTER_ADVISOR_INSTRUCTIONS,
      tools: envList('OPENROUTER_ADVISOR_TOOLS') as
        | NonNullable<OpenRouterServerToolsConfig['advisor']>['tools']
        | undefined,
      forwardTranscript: envBool('OPENROUTER_ADVISOR_FORWARD_TRANSCRIPT'),
      maxToolCalls: envInt('OPENROUTER_ADVISOR_MAX_TOOL_CALLS'),
      maxCompletionTokens: envInt('OPENROUTER_ADVISOR_MAX_COMPLETION_TOKENS'),
      temperature: envFloat('OPENROUTER_ADVISOR_TEMPERATURE')
    }),
    forceToolChoiceRequired: envBool(
      'OPENROUTER_SERVER_TOOLS_FORCE_TOOL_CHOICE_REQUIRED'
    )
  })
}

export function buildOpenRouterServerToolHeaders(
  providerId: string,
  providerOptions?: Record<string, unknown>
): Record<string, string> {
  if (providerId !== 'openrouter') return {}

  const config = sanitizeOpenRouterServerToolsConfig(
    (providerOptions as OpenRouterProviderOptions | undefined)?.openrouter
      ?.serverTools
  )

  return config
    ? {
        [OPENROUTER_SERVER_TOOLS_HEADER]: encodeHeader(config)
      }
    : {}
}

function toOpenRouterTool(config: OpenRouterServerToolsConfig, tool: string) {
  if (tool === 'fusion') {
    const fusion = config.fusion ?? {}
    return {
      type: 'openrouter:fusion',
      parameters: {
        ...(fusion.analysisModels && {
          analysis_models: fusion.analysisModels
        }),
        ...(fusion.model && { model: fusion.model }),
        ...(fusion.maxToolCalls && {
          max_tool_calls: fusion.maxToolCalls
        }),
        ...(fusion.maxCompletionTokens && {
          max_completion_tokens: fusion.maxCompletionTokens
        }),
        ...(fusion.reasoning && { reasoning: fusion.reasoning }),
        ...(fusion.temperature !== undefined && {
          temperature: fusion.temperature
        })
      }
    }
  }

  const advisor = config.advisor ?? {}
  return {
    type: 'openrouter:advisor',
    parameters: {
      ...(advisor.model && { model: advisor.model }),
      ...(advisor.advisors && { advisors: advisor.advisors }),
      ...(advisor.instructions && { instructions: advisor.instructions }),
      ...(advisor.tools && {
        tools: advisor.tools.map(toolName => ({
          type: `openrouter:${toolName}`
        }))
      }),
      ...(advisor.forwardTranscript !== undefined && {
        forward_transcript: advisor.forwardTranscript
      }),
      ...(advisor.maxToolCalls && {
        max_tool_calls: advisor.maxToolCalls
      }),
      ...(advisor.maxCompletionTokens && {
        max_completion_tokens: advisor.maxCompletionTokens
      }),
      ...(advisor.reasoning && { reasoning: advisor.reasoning }),
      ...(advisor.temperature !== undefined && {
        temperature: advisor.temperature
      })
    }
  }
}

export function appendOpenRouterServerToolsToRequest(
  body: BodyInit | null | undefined,
  headers: Headers
): BodyInit | null | undefined {
  const encoded = headers.get(OPENROUTER_SERVER_TOOLS_HEADER)
  headers.delete(OPENROUTER_SERVER_TOOLS_HEADER)
  if (!encoded || typeof body !== 'string') return body

  const config = decodeOpenRouterServerToolsHeader(encoded)
  if (!config) return body

  try {
    const json = JSON.parse(body)
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return body
    }

    const existingTools = Array.isArray(json.tools) ? json.tools : []
    const existingTypes = new Set(
      existingTools
        .map((tool: unknown) =>
          tool && typeof tool === 'object'
            ? String((tool as Record<string, unknown>).type ?? '')
            : ''
        )
        .filter(Boolean)
    )
    const serverTools = (config.tools ?? [])
      .map(toolName => toOpenRouterTool(config, toolName))
      .filter(tool => !existingTypes.has(tool.type))

    json.tools = [...existingTools, ...serverTools]
    if (config.forceToolChoiceRequired) {
      json.tool_choice = 'required'
    }

    return JSON.stringify(json)
  } catch {
    return body
  }
}
