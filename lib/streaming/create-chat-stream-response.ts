import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
  UIMessageStreamWriter
} from 'ai'

import { researcher } from '@/lib/agents/researcher'

import {
  getChat as getChatAction,
  saveChatTitle,
  saveMessage} from '../actions/chat'
import { generateRelatedQuestions } from '../agents/generate-related-questions'
import { hasToolCalls, mergeUIMessages } from '../utils/message-utils'

import {
  prepareMessagesForRegeneration,
  prepareMessagesForSubmission
} from './message-preparation'
import { BaseStreamConfig } from './types'

// Helper function to handle direct response (no tool calls)
async function handleDirectResponse(
  writer: UIMessageStreamWriter,
  researchMessage: UIMessage,
  chatId: string,
  chat: any,
  message: UIMessage | null,
  modelId: string
) {
  // Save research message
  await saveMessage(chatId, researchMessage)

  // Generate proper title after conversation starts
  await saveChatTitle(chat, chatId, message, modelId)

  // Send a finish message to complete the stream
  writer.write({ type: 'finish' })
}

// Helper function to generate related questions
async function generateRelatedQuestionsStream(
  writer: UIMessageStreamWriter,
  researchResult: any,
  messagesToModel: UIMessage[],
  modelId: string,
  researchMessage: UIMessage,
  chatId: string,
  chat: any,
  message: UIMessage | null
) {
  try {
    // Get the research data
    const researchData = await researchResult.response

    // Check if request was aborted
    if (researchData.messages.length === 0) {
      return
    }

    // Prepare messages for related questions agent
    const allMessages = [
      ...convertToModelMessages(messagesToModel),
      ...researchData.messages
    ]

    // Get related questions agent
    const relatedQuestionsAgent = generateRelatedQuestions(modelId)
    const relatedQuestionsResult = relatedQuestionsAgent.stream({
      messages: allMessages
    })

    // Merge related questions stream
    writer.merge(
      relatedQuestionsResult.toUIMessageStream({
        sendStart: false,
        onFinish: async ({ responseMessage }) => {
          const relatedQuestionsMessage = responseMessage

          // Save the complete message after both agents finish
          if (researchMessage && relatedQuestionsMessage) {
            const mergedMessage = mergeUIMessages(
              researchMessage,
              relatedQuestionsMessage
            )
            await saveMessage(chatId, mergedMessage)
          } else if (researchMessage) {
            // Save research message only if related questions failed
            await saveMessage(chatId, researchMessage)
          }

          // Generate proper title after conversation starts
          await saveChatTitle(chat, chatId, message, modelId)
        }
      })
    )
  } catch (error) {
    console.error('Error generating related questions:', error)
    // Save research message even if related questions fail
    await saveMessage(chatId, researchMessage)
  }
}

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const { message, model, chatId, searchMode, userId, trigger, messageId } =
    config
  const modelId = `${model.providerId}:${model.id}`

  // Verify that chatId is provided
  if (!chatId) {
    return new Response('Chat ID is required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  // Fetch chat data for authorization check
  const chat = await getChatAction(chatId, userId)

  // Authorization check: if chat exists, it must belong to the user
  if (chat && chat.userId !== userId) {
    return new Response('You are not allowed to access this chat', {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // Create the stream
  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        // Prepare messages based on trigger type
        let messagesToModel: UIMessage[]
        
        if (trigger === 'regenerate-assistant-message' && messageId) {
          messagesToModel = await prepareMessagesForRegeneration(
            chatId,
            userId,
            messageId,
            message
          )
        } else {
          messagesToModel = await prepareMessagesForSubmission(
            chatId,
            userId,
            message!,
            chat
          )
        }

        // Get the researcher agent
        const researchAgent = researcher({
          model: modelId,
          searchMode
        })

        // Stream with the research agent
        const researchResult = researchAgent.stream({
          messages: convertToModelMessages(messagesToModel)
        })

        // Store research message for later use
        let researchMessage: UIMessage | null = null

        // Merge research stream without finishing and capture the message
        writer.merge(
          researchResult.toUIMessageStream({
            sendFinish: false,
            onFinish: async ({ responseMessage }) => {
              researchMessage = responseMessage

              // If no tool calls (just answering), skip related questions
              if (!hasToolCalls(researchMessage)) {
                await handleDirectResponse(
                  writer,
                  researchMessage!,
                  chatId,
                  chat,
                  message,
                  modelId
                )
                return
              }

              // If we have tool calls, proceed with related questions generation
              await generateRelatedQuestionsStream(
                writer,
                researchResult,
                messagesToModel,
                modelId,
                researchMessage!,
                chatId,
                chat,
                message
              )
            }
          })
        )
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error // This error will be handled by the onError callback
      }
    },
    onError: (error: any) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })

  return createUIMessageStreamResponse({ stream })
}