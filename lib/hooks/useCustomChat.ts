import { useAppStore } from '@/lib/store' // Import the store
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query' // Import react-query hooks and useMutation
import { Message } from 'ai' // Import Message type
import { nanoid } from 'nanoid' // Para gerar IDs únicos para mensagens
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatMessage, db } from '../db'
import { ChatService } from '../services/chat'
import { QuestionResponse } from '../types/chat' // Assuming QuestionResponse contains thread_id and answer

// Define a query key factory for consistency
const chatKeys = {
  all: ['chats'] as const,
  detail: (chatId: string | null) =>
    [...chatKeys.all, 'detail', chatId] as const
}

export function useCustomChat(
  chatIdProp: string | 'new' = 'new',
  initialMessages?: Message[]
) {
  console.log(
    '[useCustomChat] Initializing hook with chatId prop:',
    chatIdProp,
    'Initial Messages Count:',
    initialMessages?.length
  )

  const queryClient = useQueryClient() // Get query client instance
  const currentChatId = useAppStore(state => state.currentChatId)
  const setCurrentChatId = useAppStore(state => state.setCurrentChatId)

  // Removed local messages state - will come from useQuery
  // Removed local isLoading state - will come from useQuery
  // Removed local error state - will come from useQuery
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>(
    []
  )

  // Ref to track if initial load for the current store chat ID is done
  const initialLoadDoneRef = useRef(false)
  // Ref to track the current store chat ID to compare in effects
  const storeChatIdRef = useRef(currentChatId)

  console.log(
    '[useCustomChat] Initial state - Store currentChatId:',
    currentChatId
  )

  // Effect 1: Initialize store's currentChatId based on prop if needed (runs once)
  useEffect(() => {
    const initialIdFromProp = chatIdProp === 'new' ? null : chatIdProp
    console.log(
      `[useCustomChat Init Effect] Running. Prop: ${chatIdProp}, Initial Store ID: ${currentChatId}`
    )
    // If the store ID is null (initial state) and the prop provides an ID,
    // or if the prop ID differs from a non-null store ID (e.g., navigating directly to a chat page)
    if (
      (currentChatId === null && initialIdFromProp !== null) ||
      (initialIdFromProp !== null && currentChatId !== initialIdFromProp)
    ) {
      console.log(
        `[useCustomChat Init Effect] Setting store currentChatId from prop: ${initialIdFromProp}`
      )
      setOptimisticMessages([])
      setCurrentChatId(initialIdFromProp)
      queryClient.invalidateQueries({
        queryKey: chatKeys.detail(initialIdFromProp)
      })
      initialLoadDoneRef.current = false // Reset load flag as ID is changing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdProp]) // Run only when the initial prop changes (should be rare)

  // Map initialMessages to ChatMessage[] if provided
  const mappedInitialMessages: ChatMessage[] | undefined = initialMessages?.map(
    msg => ({
      id: msg.id,
      role: msg.role as ChatMessage['role'], // Cast role
      content: msg.content,
      createdAt: msg.createdAt || new Date(), // Use provided or default
      chatId: currentChatId || 'shared-chat' // Assign the current chat ID or a placeholder
      // Add other ChatMessage fields as needed, potentially with defaults
    })
  )

  // --- Data Fetching with React Query ---
  const {
    data: messages = [], // Default to empty array if data is undefined
    isLoading: messagesIsLoading,
    error: messagesError
  } = useQuery<ChatMessage[]>({
    queryKey: chatKeys.detail(currentChatId),
    queryFn: async (): Promise<ChatMessage[]> => {
      // Ensure queryFn returns ChatMessage[]
      // If mapped initial messages exist, use them directly
      if (mappedInitialMessages) {
        console.log(
          '[useQuery messages] Using mapped initialMessages. Count:',
          mappedInitialMessages.length
        )
        return mappedInitialMessages
      }
      if (!currentChatId) {
        console.log(
          '[useQuery messages] No chatId and no initialMessages, returning empty array.'
        )
        return []
      }
      console.log(
        `[useQuery messages] Fetching messages from DB for chat ID: ${currentChatId}`
      )
      const loadedMessages = await db.getChatMessages(currentChatId)
      console.log(
        `[useQuery messages] Fetched ${loadedMessages.length} messages from DB for ${currentChatId}`
      )
      return loadedMessages
    },
    initialData: mappedInitialMessages, // Use the mapped messages
    enabled: true, // Always enabled, queryFn handles logic based on IDs/initialData
    staleTime: mappedInitialMessages ? Infinity : 5 * 60 * 1000,
    refetchOnWindowFocus: !mappedInitialMessages
  })

  // Combine messages from query with optimistic messages
  const displayMessages = [...messages, ...optimisticMessages]

  // --- Mutation with useMutation for sending messages ---
  const sendMessageMutation = useMutation<
    QuestionResponse, // Type of data returned by the mutationFn
    Error, // Type of error
    {
      content: string
      threadIdToSend: string | 'create'
      userMessage: ChatMessage
      isNewChat: boolean
    }, // Type of variables passed to mutationFn
    { optimisticMessageId: string } // Type of context (optional, for optimistic updates)
  >({
    mutationFn: async ({ content, threadIdToSend }) => {
      // This is the actual API call
      return ChatService.askQuestion(content, threadIdToSend)
    },
    // Optimistic Update Logic
    onMutate: async variables => {
      console.log('[useMutation] onMutate - Adding optimistic message')
      // Add optimistic message to state
      setOptimisticMessages(prev => [...prev, variables.userMessage])
      // Return context with the optimistic message ID
      return { optimisticMessageId: variables.userMessage.id }
    },
    onSuccess: async (data, variables, context) => {
      console.log('[useMutation] onSuccess - Handling API response')
      const newChatId = data.thread_id
      const assistantContent = data.content || '[No content received]'
      const finalUserMessage = { ...variables.userMessage, chatId: newChatId }

      // Persist messages to DB
      if (variables.isNewChat) {
        console.log(
          `[useMutation onSuccess] New chat created with ID: ${newChatId}. Updating store.`
        )
        setCurrentChatId(newChatId) // Update store first
        const initialTitle =
          variables.userMessage.content.substring(0, 50) +
          (variables.userMessage.content.length > 50 ? '...' : '')
        try {
          await db.createChat(newChatId, initialTitle)
          console.log(
            `[useMutation onSuccess] db.createChat called for ${newChatId}`
          )
        } catch (dbError) {
          console.error(
            '[useMutation onSuccess] Error calling db.createChat:',
            dbError
          )
          // Handle error appropriately - maybe revert optimistic UI?
        }
      }
      await db.addChatMessage(finalUserMessage)
      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: assistantContent,
        chatId: newChatId,
        createdAt: new Date(),
        thread_id: data.thread_id
      }
      await db.addChatMessage(assistantMessage)

      // Remove optimistic message now that data is persisted
      if (context?.optimisticMessageId) {
        console.log('[useMutation] onSuccess - Removing optimistic message')
        setOptimisticMessages(prev =>
          prev.filter(msg => msg.id !== context.optimisticMessageId)
        )
      }

      // Invalidation will happen in onSettled
    },
    onError: (error, variables, context) => {
      console.error('[useMutation] onError:', error)
      // Remove optimistic message if mutation failed
      if (context?.optimisticMessageId) {
        console.log('[useMutation] onError - Removing optimistic message')
        setOptimisticMessages(prev =>
          prev.filter(msg => msg.id !== context.optimisticMessageId)
        )
      }
      // TODO: Set error state to display to user
    },
    onSettled: async (data, error, variables) => {
      console.log('[useMutation] onSettled - Invalidating query')
      // Always refetch messages after mutation succeeds or fails
      const chatIdToInvalidate = data?.thread_id ?? variables.threadIdToSend
      // Ensure we don't invalidate with 'create' or a temporary ID
      if (
        chatIdToInvalidate &&
        chatIdToInvalidate !== 'create' &&
        !chatIdToInvalidate.startsWith('pending-')
      ) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.detail(chatIdToInvalidate)
        })
      } else if (variables.isNewChat && !data?.thread_id) {
        // If it was a new chat but failed before getting an ID, maybe invalidate null?
        // Or rely on error handling to clear optimistic message.
        console.warn(
          '[useMutation] onSettled - New chat failed before getting ID. Not invalidating.'
        )
      } else if (data?.thread_id) {
        // If it succeeded and we got an ID
        queryClient.invalidateQueries({
          queryKey: chatKeys.detail(data.thread_id)
        })
      }
    }
  })

  // --- Exposed Functions ---

  // Updated sendMessage to trigger the mutation
  const sendMessage = useCallback(
    (content: string, threadId?: string) => {
      if (!content.trim()) return

      const currentStoreChatId = useAppStore.getState().currentChatId
      const currentThreadId = threadId ?? currentStoreChatId
      const isNewChat = !currentThreadId
      // Use a real temporary ID for the optimistic message for potential removal
      const tempUserMessageId = nanoid()
      const tempChatId = currentThreadId ?? `pending-${tempUserMessageId}`
      const threadIdToSend = currentThreadId ?? 'create'

      console.log(
        '[useCustomChat sendMessage] Triggering mutation. isNewChat:',
        isNewChat,
        'threadIdToSend:',
        threadIdToSend,
        'store currentChatId:',
        currentStoreChatId
      )

      const userMessage: ChatMessage = {
        id: tempUserMessageId, // Use the temporary ID generated
        role: 'user',
        content,
        chatId: tempChatId, // Use temp ID for optimistic message chatId
        createdAt: new Date()
      }

      // Call the mutation
      sendMessageMutation.mutate({
        content,
        threadIdToSend,
        userMessage,
        isNewChat
      })
    },
    [sendMessageMutation] // Depend on the mutation trigger
  )

  // submitQueryFromOutline remains the same, calling the new sendMessage
  const submitQueryFromOutline = useCallback(
    async (itemText: string, threadId: string) => {
      console.log(
        '[useCustomChat submitQueryFromOutline] Sending query:',
        itemText,
        'with threadId:',
        threadId
      )
      sendMessage(itemText, threadId) // Calls the mutation via sendMessage
    },
    [sendMessage]
  )

  // clearChat remains the same
  const clearChat = useCallback(async () => {
    const storeId = useAppStore.getState().currentChatId
    if (storeId) {
      console.log(`[useCustomChat clearChat] Clearing messages for ${storeId}`)
      await db.clearChatMessages(storeId)
      setOptimisticMessages([]) // Clear optimistic messages too
      // Invalidate query to show empty list
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(storeId) })
      // Resetting store chat ID should be handled elsewhere (e.g., navigation)
    }
  }, [queryClient]) // Add queryClient dependency

  // Return object
  return {
    messages: displayMessages, // Use the combined messages
    isLoading: messagesIsLoading || sendMessageMutation.isPending, // Combine query loading and mutation pending states
    error: messagesError || sendMessageMutation.error, // Combine query error and mutation error
    sendMessage,
    addUserMessageOptimistically: sendMessage,
    clearChat,
    submitQueryFromOutline
    // Removed setMessages from return
  }
}
