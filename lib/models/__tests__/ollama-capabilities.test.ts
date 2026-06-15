import { describe, expect, it } from 'vitest'

import {
  getOllamaChatSettings,
  inferOllamaModelCapabilities,
  isOllamaAppChatModel,
  normalizeOllamaApiCapabilities
} from '../ollama-capabilities'

describe('Ollama capability inference', () => {
  it('marks cloud GPT-OSS models as streaming tool-capable thinking models with web search', () => {
    expect(
      inferOllamaModelCapabilities('gpt-oss:120b', 'ollama-cloud')
    ).toEqual(['chat', 'streaming', 'toolCalling', 'thinking', 'webSearch'])
    expect(getOllamaChatSettings('gpt-oss:120b')).toEqual({ think: 'medium' })
  })

  it('marks Qwen3 VL models as thinking and vision capable', () => {
    expect(
      inferOllamaModelCapabilities('qwen3-vl:235b-cloud', 'ollama-cloud')
    ).toEqual([
      'chat',
      'streaming',
      'toolCalling',
      'thinking',
      'vision',
      'webSearch'
    ])
    expect(getOllamaChatSettings('qwen3-vl:235b-cloud')).toEqual({
      think: true
    })
  })

  it('does not route embedding-only models into Morphic chat', () => {
    expect(inferOllamaModelCapabilities('nomic-embed-text')).toEqual([
      'embeddings'
    ])
    expect(isOllamaAppChatModel('nomic-embed-text')).toBe(false)
  })

  it('uses exact /api/show capabilities when they are available', () => {
    expect(
      normalizeOllamaApiCapabilities('gemma4:31b', 'ollama-cloud', [
        'completion',
        'vision'
      ])
    ).toEqual(['chat', 'streaming', 'vision', 'webSearch'])
    expect(
      isOllamaAppChatModel('gemma4:31b', 'ollama-cloud', [
        'completion',
        'vision'
      ])
    ).toBe(false)
    expect(
      normalizeOllamaApiCapabilities('gpt-oss:120b', 'ollama-cloud', [
        'completion',
        'tools',
        'thinking'
      ])
    ).toEqual(['chat', 'streaming', 'toolCalling', 'thinking', 'webSearch'])
  })

  it('leaves non-thinking chat models without a think setting', () => {
    expect(inferOllamaModelCapabilities('llama3.2:3b')).toEqual([
      'chat',
      'streaming',
      'toolCalling',
      'structuredOutputs'
    ])
    expect(getOllamaChatSettings('llama3.2:3b')).toEqual({})
  })
})
