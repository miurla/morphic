import { API_CONFIG, getApiUrl } from '../config/env'
import { QuestionRequest, QuestionResponse } from '../types/chat'

export class ChatService {
  static async askQuestion(
    question: string,
    threadId: string = 'create'
  ): Promise<QuestionResponse> {
    console.log(
      '[ChatService askQuestion] Received threadId parameter:',
      threadId
    )

    const payload: QuestionRequest = {
      content: question,
      thread_id: threadId
      // Você pode adicionar outros campos como instructions, user_id, etc. aqui se necessário
    }

    console.log(
      'Sending request to:',
      getApiUrl(`/assistants/${API_CONFIG.ASSISTANT_ID}/ask`)
    )
    console.log('Payload:', payload)

    try {
      const response = await fetch(
        getApiUrl(`/assistants/${API_CONFIG.ASSISTANT_ID}/ask`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Adicione headers de autenticação aqui se necessário no futuro
          },
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('API Error Response Body:', errorBody)
        throw new Error(
          `API error: ${response.status} ${response.statusText} - ${errorBody}`
        )
      }

      const data: QuestionResponse = await response.json()
      console.log('Received response:', data)
      return data
    } catch (error) {
      console.error('Error in askQuestion:', error)
      throw error // Re-throw para que o hook possa tratar
    }
  }
}
