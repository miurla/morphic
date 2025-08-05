import { anthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { deepseek } from '@ai-sdk/deepseek'
import { createFireworks, fireworks } from '@ai-sdk/fireworks'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { xai } from '@ai-sdk/xai'
import {
    createProviderRegistry,
    extractReasoningMiddleware,
    LanguageModel,
    wrapLanguageModel
} from 'ai'

export const registry = createProviderRegistry({
    openai,
    anthropic,
    google,
    groq,
    azure: createAzure({
        apiKey: process.env.AZURE_API_KEY,
        resourceName: process.env.AZURE_RESOURCE_NAME,
        apiVersion: '2025-03-01-preview'
    }),
    deepseek,
    fireworks: {
        ...createFireworks({
            apiKey: process.env.FIREWORKS_API_KEY
        }),
        languageModel: fireworks
    },
    'openai-compatible': createOpenAI({
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
        baseURL: process.env.OPENAI_COMPATIBLE_API_BASE_URL
    }),
    xai,
    // Add AI Gateway provider
    gateway: createGateway({
        apiKey: process.env.AI_GATEWAY_API_KEY
    })
})

export function getModel(model: string): LanguageModel {
    const [provider, ...modelNameParts] = model.split(':') ?? []
    const modelName = modelNameParts.join(':')

    // if model is groq and includes deepseek-r1, add reasoning middleware
    if (model.includes('groq') && model.includes('deepseek-r1')) {
        return wrapLanguageModel({
            model: groq(modelName),
            middleware: extractReasoningMiddleware({
                tagName: 'think'
            })
        })
    }

    // if model is fireworks and includes deepseek-r1, add reasoning middleware
    if (model.includes('fireworks') && model.includes('deepseek-r1')) {
        return wrapLanguageModel({
            model: fireworks(modelName),
            middleware: extractReasoningMiddleware({
                tagName: 'think'
            })
        })
    }

    return registry.languageModel(
        model as Parameters<typeof registry.languageModel>[0]
    )
}

export function isProviderEnabled(providerId: string): boolean {
    switch (providerId) {
        case 'openai':
            return !!process.env.OPENAI_API_KEY
        case 'anthropic':
            return !!process.env.ANTHROPIC_API_KEY
        case 'google':
            return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
        case 'groq':
            return !!process.env.GROQ_API_KEY
        case 'ollama':
            return !!process.env.OLLAMA_BASE_URL
        case 'azure':
            return !!process.env.AZURE_API_KEY && !!process.env.AZURE_RESOURCE_NAME
        case 'deepseek':
            return !!process.env.DEEPSEEK_API_KEY
        case 'fireworks':
            return !!process.env.FIREWORKS_API_KEY
        case 'xai':
            return !!process.env.XAI_API_KEY
        case 'openai-compatible':
            return (
                !!process.env.OPENAI_COMPATIBLE_API_KEY &&
                !!process.env.OPENAI_COMPATIBLE_API_BASE_URL
            )
        case 'gateway':
            return !!process.env.AI_GATEWAY_API_KEY
        default:
            return false
    }
}

export function getToolCallModel(model?: string) {
    const [provider, ...modelNameParts] = model?.split(':') ?? []
    const modelName = modelNameParts.join(':')
    switch (provider) {
        case 'deepseek':
            return getModel('deepseek:deepseek-chat')
        case 'fireworks':
            return getModel(
                'fireworks:accounts/fireworks/models/llama-v3p1-8b-instruct'
            )
        case 'groq':
            return getModel('groq:llama-3.1-8b-instant')
        case 'ollama':
            const ollamaModel =
                process.env.NEXT_PUBLIC_OLLAMA_TOOL_CALL_MODEL || modelName
            return getModel(`ollama:${ollamaModel}`)
        case 'google':
            return getModel('google:gemini-2.0-flash')
        case 'gateway':
            // For gateway models, we need to determine the underlying provider
            // and use an appropriate tool call model
            if (modelName?.includes('openai')) {
                return getModel('gateway:openai/gpt-4o-mini')
            } else if (modelName?.includes('anthropic')) {
                return getModel('gateway:anthropic/claude-3-5-sonnet-20241022')
            } else if (modelName?.includes('groq')) {
                return getModel('gateway:groq/llama-3.1-8b-instant')
            } else {
                return getModel('gateway:openai/gpt-4o-mini')
            }
        default:
            return getModel('openai:gpt-4o-mini')
    }
}

export function isToolCallSupported(model?: string) {
    const [provider, ...modelNameParts] = model?.split(':') ?? []
    const modelName = modelNameParts.join(':')

    if (provider === 'ollama') {
        return false
    }

    if (provider === 'google') {
        return false
    }

    // For gateway models, check the underlying provider
    if (provider === 'gateway') {
        if (modelName?.includes('google')) {
            return false
        }
        // Most other providers support tool calling
        return true
    }

    // Deepseek R1 is not supported
    // Deepseek v3's tool call is unstable, so we include it in the list
    return !modelName?.includes('deepseek')
}

export function isReasoningModel(model: string): boolean {
    if (typeof model !== 'string') {
        return false
    }
    return (
        model.includes('deepseek-r1') ||
        model.includes('deepseek-reasoner') ||
        model.includes('o3-mini')
    )
}
