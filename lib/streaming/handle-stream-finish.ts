import { getChat, saveChat } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { ExtendedCoreMessage } from '@/lib/types'
import { convertToExtendedCoreMessages } from '@/lib/utils'
import { CoreMessage, DataStreamWriter, JSONValue, Message } from 'ai'

interface HandleStreamFinishParams {
  responseMessages: CoreMessage[]
  originalMessages: Message[]
  model: string
  chatId: string
  dataStream: DataStreamWriter
  skipRelatedQuestions?: boolean
  annotations?: ExtendedCoreMessage[]
}

export async function handleStreamFinish({
  responseMessages,
  originalMessages,
  model,
  chatId,
  dataStream,
  skipRelatedQuestions = false,
  annotations = []
}: HandleStreamFinishParams) {
  try {
    const extendedCoreMessages = convertToExtendedCoreMessages(originalMessages)
    let allAnnotations = [...annotations]

    if (!skipRelatedQuestions) {
      // Notify related questions loading
      const relatedQuestionsAnnotation: JSONValue = {
        type: 'related-questions',
        data: { items: [] }
      }
      dataStream.writeMessageAnnotation(relatedQuestionsAnnotation)

      // Generate related questions
      const relatedQuestions = await generateRelatedQuestions(
        responseMessages,
        model
      )

      // Create and add related questions annotation
      const updatedRelatedQuestionsAnnotation: ExtendedCoreMessage = {
        role: 'data',
        content: {
          type: 'related-questions',
          data: relatedQuestions.object
        } as JSONValue
      }

      dataStream.writeMessageAnnotation(
        updatedRelatedQuestionsAnnotation.content as JSONValue
      )
      allAnnotations.push(updatedRelatedQuestionsAnnotation)
    }

    // Create the message to save
    const generatedMessages = [
      ...extendedCoreMessages,
      ...responseMessages.slice(0, -1),
      ...allAnnotations, // Add annotations before the last message
      ...responseMessages.slice(-1)
    ] as ExtendedCoreMessage[]

    if (process.env.ENABLE_SAVE_CHAT_HISTORY !== 'true') {
      return
    }

    // Get the chat from the database if it exists, otherwise create a new one
    const savedChat = (await getChat(chatId)) ?? {
      messages: [],
      createdAt: new Date(),
      userId: 'anonymous',
      path: `/search/${chatId}`,
      title: originalMessages[0].content,
      id: chatId
    }

    // Save chat with complete response and related questions
    await saveChat({
      ...savedChat,
      messages: generatedMessages
    }).catch(error => {
      console.error('Failed to save chat:', error)
      throw new Error('Failed to save chat history')
    })
  } catch (error) {
    console.error('Error in handleStreamFinish:', error)
    throw error
  }
}
