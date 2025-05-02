import { anthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { deepseek } from '@ai-sdk/deepseek'
import { createFireworks, fireworks } from '@ai-sdk/fireworks'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { xai } from '@ai-sdk/xai'
import {
  createProviderRegistry,
  extractReasoningMiddleware,
  wrapLanguageModel
} from 'ai'
import { createOllama } from 'ollama-ai-provider'
// import '../debug/request-logger'; // runs once per server start

// 1️⃣ Define your per-model paths (note the leading “/” on each):
const RITS_MODEL_PATHS: Record<string, string> = {
  // key ⟶ value
  "meta-llama/llama-3-3-70b-instruct":   "/llama-3-3-70b-instruct/v1",
  "meta-llama/llama-4-maverick-17b-128e-instruct-fp8": "/llama-4-mvk-17b-128e-fp8/v1",
  "meta-llama/llama-4-scout-17b-16e": "/llama-4-scout-17b-16e/v1",
  "Qwen/Qwen2.5-72B-Instruct":           "/qwen2-5-72b-instruct/v1",
};

// ---------- build one provider object ----------
const createRITSProvider = () => {
  const baseClient = createOpenAI({
    apiKey: process.env.IBM_RITS_API_KEY!,
    baseURL: process.env.IBM_RITS_API_BASE_URL!,
    compatibility: 'compatible'
  });

  return {
    ...baseClient,
    languageModel(modelId: string, opts?: any) {
      const path = RITS_MODEL_PATHS[modelId];
      if (!path) {
        throw new Error(`No RITS endpoint configured for "${modelId}"`);
      }

      const apiKey = process.env.IBM_RITS_API_KEY!;
      const baseURL = `${process.env.IBM_RITS_API_BASE_URL}${path}`;

      const client = createOpenAI({
        apiKey,                // ⇒ Authorization: Bearer <key>
        baseURL,

        /* ▲▲▲ 1. put custom headers here, not in baseOptions */
        headers: {
          RITS_API_KEY: apiKey // exact casing RITS expects
        },

        /* 2. add compatibility flag (safer with non-OpenAI back-end) */
        compatibility: 'compatible'
      });

      console.log(
        `⛳ model: ${modelId}  baseURL: ${baseURL} set`
      );

      return client.languageModel(modelId, opts);
    }
  };
};

// -------------------------------------
const createOpenRouterProvider = () => {
  const client = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: process.env.OPENROUTER_BASE_URL!,
    compatibility: "compatible"
  });

  return {
    ...client,
    languageModel(modelId: string, opts?: any) {
      console.log(
        `⛳ model: ${modelId}  baseURL: ${process.env.OPENROUTER_BASE_URL!}`
      );
      return client.languageModel(modelId, opts);
    }
  };
};


export const registry = createProviderRegistry({
  openai,
  anthropic,
  google,
  groq,
  ollama: createOllama({
    baseURL: `${process.env.OLLAMA_BASE_URL}/api`
  }),
  azure: createAzure({
    apiKey: process.env.AZURE_API_KEY,
    resourceName: process.env.AZURE_RESOURCE_NAME
  }),
  deepseek,
  fireworks: {
    ...createFireworks({
      apiKey: process.env.FIREWORKS_API_KEY
    }),
    languageModel: fireworks
  },
  'rits': createRITSProvider(),
  'openrouter': createOpenRouterProvider(),
  xai
})
//synch back to the main i mesesd this one up again. 
// Using registry as any to access internal properties for debugging
const registryAny = registry as any;
console.log("✅ has languageModel:",
            typeof registryAny.providers?.['rits']?.languageModel);
console.log("🔹 registry.providers keys:", Object.keys(registryAny.providers || {}));
console.log("➤ models.json content:", JSON.stringify(registryAny, null,2));
console.log("📦 Providers:", Object.keys(registry as any));

// console.log("🔍 RITS_MODEL_PATHS keys:", Object.keys(RITS_MODEL_PATHS));

export function getModel(model: string) {
  const [provider, ...modelNameParts] = model.split(':') ?? []
  const modelName = modelNameParts.join(':')
  if (model.includes('ollama')) {
    const ollama = createOllama({
      baseURL: `${process.env.OLLAMA_BASE_URL}/api`
    })

    // if model is deepseek-r1, add reasoning middleware
    if (model.includes('deepseek-r1')) {
      return wrapLanguageModel({
        model: ollama(modelName),
        middleware: extractReasoningMiddleware({
          tagName: 'think'
        })
      })
    }

    // if ollama provider, set simulateStreaming to true
    return ollama(modelName, {
      simulateStreaming: true
    })
  }

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
    case 'rits':
      return (
        !!process.env.IBM_RITS_API_KEY &&
        !!process.env.IBM_RITS_API_BASE_URL
      )
    case 'openrouter':
      return (
        !!process.env.OPENROUTER_API_KEY &&
        !!process.env.OPENROUTER_BASE_URL
      )
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
