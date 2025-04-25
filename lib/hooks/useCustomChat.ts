import { useLiveQuery } from 'dexie-react-hooks'
import { nanoid } from 'nanoid' // Para gerar IDs únicos para mensagens
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatMessage, db } from '../db'
import { ChatService } from '../services/chat'

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

  // Mantém a referência ao ID do chat atual para evitar dependências excessivas em useEffect
  const chatIdRef = useRef(currentChatId)

  // Log do estado inicial após useRef
  console.log(
    '[useCustomChat] Initial state - currentChatId:',
    currentChatId,
    'chatIdRef.current:',
    chatIdRef.current
  )

  useEffect(() => {
    // Log quando chatIdRef é atualizado
    console.log('[useCustomChat] Updating chatIdRef.current to:', currentChatId)
    chatIdRef.current = currentChatId
  }, [currentChatId])

  // Carrega mensagens do Dexie quando o chatId muda
  const initialMessages = useLiveQuery(
    () =>
      currentChatId ? db.getChatMessages(currentChatId) : Promise.resolve([]),
    [currentChatId],
    [] // Estado inicial vazio enquanto carrega
  )

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    setIsLoading(true)
    setError(null)

    // Log antes de determinar threadIdToSend
    console.log(
      '[useCustomChat sendMessage] Before determining threadIdToSend - chatIdRef.current:',
      chatIdRef.current
    )

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
      chatId: chatIdRef.current ?? 'pending',
      createdAt: new Date()
    }

    // Guarda o conteúdo da primeira mensagem para usar como título
    const isFirstMessage = !chatIdRef.current

    setMessages(prev => [...prev, userMessage])
    // Adicionar ao DB apenas se já temos ID, senão esperar a resposta
    // if (chatIdRef.current) {
    //   await db.addChatMessage({ ...userMessage, chatId: chatIdRef.current })
    // }

    try {
      const threadIdToSend = chatIdRef.current ?? 'create'
      // Log do threadId que será enviado
      console.log(
        '[useCustomChat sendMessage] Determined threadIdToSend:',
        threadIdToSend
      )

      const response = await ChatService.askQuestion(content, threadIdToSend)
      const newChatId = response.thread_id

      // Atualiza a mensagem do usuário com o chatId correto ANTES de adicionar ao DB
      const finalUserMessage = { ...userMessage, chatId: newChatId }

      // Se for um novo chat, cria a entrada no DB para o chat E adiciona a msg do user
      if (isFirstMessage) {
        setCurrentChatId(newChatId)
        // Usa o conteúdo da primeira mensagem como título inicial
        const initialTitle =
          content.substring(0, 50) + (content.length > 50 ? '...' : '')
        await db.createChat(newChatId, initialTitle)
        await db.addChatMessage(finalUserMessage)
        // Atualiza o estado da UI para refletir o novo chatId na msg do usuário
        // (Isso pode ser redundante se setMessages abaixo incluir a versão atualizada)
        // setMessages(prev => prev.map(msg => msg.id === userMessage.id ? finalUserMessage : msg));
      } else {
        // Se não for novo, apenas adiciona a msg do usuário ao chat existente
        await db.addChatMessage(finalUserMessage)
      }

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: response.answer,
        chatId: newChatId,
        createdAt: new Date()
      }

      // Adiciona resposta do assistente à UI e ao DB
      // Garante que a mensagem do usuário no estado local também tem o ID correto
      setMessages(prev => [
        ...prev.map(msg =>
          msg.id === userMessage.id ? finalUserMessage : msg
        ),
        assistantMessage
      ])
      await db.addChatMessage(assistantMessage)
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      // Remove a mensagem do usuário da UI se a chamada falhar
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id))
      // Não tentamos remover do DB pois ela pode não ter sido adicionada ou ter ID errado
    } finally {
      setIsLoading(false)
    }
  }, []) // Fim do useCallback

  const clearChat = useCallback(async () => {
    if (currentChatId) {
      await db.clearChatMessages(currentChatId)
      setMessages([]) // Limpa as mensagens na UI
    }
  }, [currentChatId])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    currentChatId,
    setCurrentChatId // Para poder mudar de chat externamente se necessário
  }
}
