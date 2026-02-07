import { generateText } from 'ai'

import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

interface GenerateChatTitleParams {
  userMessageContent: string
  modelId: string
  abortSignal?: AbortSignal
  parentTraceId?: string
}

/**
 * Generates a concise chat title using an LLM.
 * @param userMessageContent The content of the user's first message.
 * @param model The language model instance to use for generation.
 * @returns A promise that resolves to the generated title string.
 */
export async function generateChatTitle({
  userMessageContent,
  modelId,
  abortSignal,
  parentTraceId
}: GenerateChatTitleParams): Promise<string> {
  // Fallback title uses the first 75 characters of the message or a default string.
  const fallbackTitle = userMessageContent.substring(0, 75).trim() || 'New Chat'

  try {
    const systemPrompt = `System: You are an AI assistant specialized in creating very short, concise, and informative titles for chat conversations based on the user's first message. The title should ideally be 3-5 words long, and no more than 10 words. Only output the title itself, with no prefixes, labels, or quotation marks.`

    const { text: generatedTitle } = await generateText({
      model: getModel(modelId),
      system: systemPrompt,
      prompt: userMessageContent,
      abortSignal,
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'title-generation',
        metadata: {
          modelId: modelId,
          agentType: 'title-generator',
          promptLength: userMessageContent.length,
          ...(parentTraceId && {
            langfuseTraceId: parentTraceId,
            langfuseUpdateParent: false
          })
        }
      }
    })

    const cleanedTitle = generatedTitle.trim()

    // If the model returns an empty string, use the fallback.
    if (!cleanedTitle) {
      console.warn('LLM generated an empty title, using fallback.')
      return fallbackTitle
    }

    // Remove any surrounding quotes that the model might have added
    return cleanedTitle.replace(/^[\"']|[\"']$/g, '')
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'ResponseAborted')
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.info('Title generation aborted; using fallback title.')
      }
    } else {
      console.error('Error generating chat title with LLM:', error)
    }
    // If LLM generation fails or is aborted, return the fallback title.
    return fallbackTitle
  }
}
