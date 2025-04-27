import { nanoid } from 'nanoid' // Para gerar IDs únicos para mensagens
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatMessage, db } from '../db'
import { ChatService } from '../services/chat'
import { QuestionResponse } from '../types/chat' // Assuming QuestionResponse contains thread_id and answer

// Definindo o estado inicial
const initialState = {
  messages: [],
  isLoading: false,
  error: null
}

export function useCustomChat(chatId: string | 'new' = 'new') {
  // Log inicial
  console.log('[useCustomChat] Initializing hook with chatId prop:', chatId)

  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chatId === 'new' ? null : chatId
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const chatIdRef = useRef(currentChatId)
  const initialChatIdProp = useRef(chatId) // Store the initial prop value

  console.log(
    '[useCustomChat] Initial state - currentChatId:',
    currentChatId,
    'chatIdRef.current:',
    chatIdRef.current
  )

  useEffect(() => {
    console.log('[useCustomChat] Updating chatIdRef.current to:', currentChatId)
    chatIdRef.current = currentChatId
  }, [currentChatId])

  // Effect to load messages only ONCE for existing chats when the component mounts
  useEffect(() => {
    const loadInitialMessages = async () => {
      // Use the initial prop value stored in the ref
      if (initialChatIdProp.current && initialChatIdProp.current !== 'new') {
        console.log(
          '[useCustomChat] Loading initial messages for existing chat:',
          initialChatIdProp.current
        )
        const initialMessagesData = await db.getChatMessages(
          initialChatIdProp.current
        )
        if (initialMessagesData) {
          setMessages(initialMessagesData)
          console.log(
            '[useCustomChat] Initial messages loaded:',
            initialMessagesData.length
          )
        }
      } else {
        console.log(
          '[useCustomChat] Starting a new chat, no initial messages to load.'
        )
        setMessages([]) // Ensure messages are empty for a new chat explicitly
      }
    }
    loadInitialMessages()
    // Empty dependency array ensures this runs only once on mount
  }, [])

  // Common logic to handle API response and update state/DB
  const handleApiResponse = useCallback(
    async (
      userMessage: ChatMessage,
      response: QuestionResponse,
      isNewChat: boolean
    ) => {
      const newChatId = response.thread_id // Get the definitive thread_id from response
      // Ensure response.content exists (corrected field name), otherwise provide a default message
      const assistantContent = response.content || '[No content received]' // <-- Corrected field name
      const finalUserMessage = { ...userMessage, chatId: newChatId } // Update user message with correct chatId

      if (isNewChat) {
        setCurrentChatId(newChatId)
        const initialTitle =
          userMessage.content.substring(0, 50) +
          (userMessage.content.length > 50 ? '...' : '')
        await db.createChat(newChatId, initialTitle) // Create chat thread entry
      }
      // Always add/update the user message in the DB
      await db.addChatMessage(finalUserMessage)

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: assistantContent, // Use the safe content
        chatId: newChatId,
        createdAt: new Date(),
        thread_id: response.thread_id // <-- Store the thread_id from the response here
      }

      // Update UI state
      setMessages(prev => [
        ...prev.map(msg =>
          msg.id === userMessage.id ? finalUserMessage : msg
        ),
        assistantMessage
      ])
      await db.addChatMessage(assistantMessage) // Add assistant message to DB
    },
    [setCurrentChatId] // <-- Add dependencies
  )

  const sendMessage = useCallback(
    async (content: string, threadId?: string) => {
      if (!content.trim()) return

      setIsLoading(true)
      setError(null)

      const currentThreadId = threadId ?? chatIdRef.current // Use provided threadId or the current one
      const isNewChat = !currentThreadId
      const tempChatId = currentThreadId ?? 'pending' // Use 'pending' if it's a new chat
      const threadIdToSend = currentThreadId ?? 'create' // Send 'create' for new chat

      console.log(
        '[useCustomChat sendMessage] isNewChat:',
        isNewChat,
        'threadIdToSend:',
        threadIdToSend
      )

      const userMessage: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content,
        chatId: tempChatId, // Assign temporary/current ID
        createdAt: new Date()
      }

      // Optimistic UI update
      setMessages(prev => [...prev, userMessage])

      try {
        const response = await ChatService.askQuestion(content, threadIdToSend)
        await handleApiResponse(userMessage, response, isNewChat)
      } catch (err) {
        console.error('[useCustomChat sendMessage] Error:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id)) // Rollback optimistic update
      } finally {
        setIsLoading(false)
      }
    },
    [handleApiResponse] // Include dependency
  )

  // Specific function to handle clicks from OutlineBox
  const submitQueryFromOutline = useCallback(
    async (itemText: string, threadId: string) => {
      // Reuse the sendMessage logic, providing the specific threadId
      // This ensures consistent state handling (isLoading, error, DB updates)
      console.log(
        '[useCustomChat submitQueryFromOutline] Sending query:',
        itemText,
        'with threadId:',
        threadId
      )
      await sendMessage(itemText, threadId)
    },
    [sendMessage] // Depends on sendMessage
  )

  const clearChat = useCallback(async () => {
    if (currentChatId) {
      await db.clearChatMessages(currentChatId)
      setMessages([])
    }
  }, [currentChatId])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    currentChatId,
    setCurrentChatId,
    submitQueryFromOutline // <-- Export the new function
  }
}
