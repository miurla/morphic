import { describe, expect, it } from 'vitest'

import {
  appendOpenRouterServerToolsToRequest,
  buildOpenRouterServerToolHeaders,
  createOpenRouterServerToolsProviderOptions,
  decodeOpenRouterServerToolsHeader,
  OPENROUTER_SERVER_TOOLS_HEADER,
  sanitizeOpenRouterServerToolsConfig
} from '../openrouter-server-tools'

describe('OpenRouter server tools adapter', () => {
  it('omits beta server tools for non-OpenRouter providers', () => {
    const headers = buildOpenRouterServerToolHeaders('openai', {
      openrouter: {
        serverTools: {
          enabled: true,
          tools: ['fusion']
        }
      }
    })

    expect(headers).toEqual({})
  })

  it('validates and encodes Fusion and Advisor config for OpenRouter', () => {
    const headers = buildOpenRouterServerToolHeaders('openrouter', {
      openrouter: {
        serverTools: {
          enabled: true,
          tools: ['fusion', 'advisor'],
          fusion: {
            analysisModels: ['~google/gemini-flash-latest'],
            model: '~anthropic/claude-opus-latest',
            maxToolCalls: 4,
            temperature: 0.2
          },
          advisor: {
            model: '~anthropic/claude-opus-latest',
            instructions: 'Review citations and uncertainty.',
            tools: ['web_search'],
            maxToolCalls: 3
          }
        }
      }
    })

    expect(headers[OPENROUTER_SERVER_TOOLS_HEADER]).toBeTruthy()
    expect(
      decodeOpenRouterServerToolsHeader(
        headers[OPENROUTER_SERVER_TOOLS_HEADER]!
      )
    ).toEqual({
      enabled: true,
      tools: ['fusion', 'advisor'],
      fusion: {
        analysisModels: ['~google/gemini-flash-latest'],
        model: '~anthropic/claude-opus-latest',
        maxToolCalls: 4,
        temperature: 0.2
      },
      advisor: {
        model: '~anthropic/claude-opus-latest',
        instructions: 'Review citations and uncertainty.',
        tools: ['web_search'],
        maxToolCalls: 3
      }
    })
  })

  it('fails closed when Fusion config exceeds documented model limits', () => {
    const config = sanitizeOpenRouterServerToolsConfig({
      enabled: true,
      tools: ['fusion'],
      fusion: {
        analysisModels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
      }
    })

    expect(config).toBeNull()
  })

  it('appends OpenRouter server tools to the outgoing OpenAI-compatible request body', () => {
    const providerOptions = createOpenRouterServerToolsProviderOptions({
      enabled: true,
      tools: ['fusion', 'advisor'],
      fusion: {
        analysisModels: ['~google/gemini-flash-latest'],
        model: '~openai/gpt-latest'
      },
      advisor: {
        model: '~anthropic/claude-opus-latest',
        tools: ['web_search']
      }
    })
    const headers = new Headers(
      buildOpenRouterServerToolHeaders('openrouter', providerOptions)
    )
    const body = JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [],
      tools: [
        {
          type: 'function',
          function: {
            name: 'search',
            parameters: { type: 'object' }
          }
        }
      ]
    })

    const updated = appendOpenRouterServerToolsToRequest(body, headers)

    expect(headers.has(OPENROUTER_SERVER_TOOLS_HEADER)).toBe(false)
    if (typeof updated !== 'string') {
      throw new Error('Expected OpenRouter request body to remain a string')
    }
    expect(JSON.parse(updated)).toEqual({
      model: 'google/gemini-2.5-flash',
      messages: [],
      tools: [
        {
          type: 'function',
          function: {
            name: 'search',
            parameters: { type: 'object' }
          }
        },
        {
          type: 'openrouter:fusion',
          parameters: {
            analysis_models: ['~google/gemini-flash-latest'],
            model: '~openai/gpt-latest'
          }
        },
        {
          type: 'openrouter:advisor',
          parameters: {
            model: '~anthropic/claude-opus-latest',
            tools: [{ type: 'openrouter:web_search' }]
          }
        }
      ]
    })
  })
})
