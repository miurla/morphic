import { act, renderHook, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChatMessage, db } from '../../db' // Importar tipos e o módulo para mockar
import { ChatService } from '../../services/chat'
import { QuestionResponse } from '../../types/chat'
import { useCustomChat } from '../useCustomChat' // Ajuste o caminho se necessário

// --- Mocking Dependencies ---

// Mock o módulo db inteiro
jest.mock('../../db', () => ({
  db: {
    getChatMessages: jest.fn(),
    addChatMessage: jest.fn(),
    createChat: jest.fn(),
    clearChatMessages: jest.fn()
    // Adicione outros métodos se o hook os utilizar
  },
  // Exportar o tipo ChatMessage para uso no teste
  ChatMessage: jest.fn() // Mock construtor/tipo se necessário, ou apenas deixe ser importado
}))

// Mock o ChatService.askQuestion
jest.mock('../../services/chat', () => ({
  ChatService: {
    askQuestion: jest.fn()
  }
}))

// Mock useLiveQuery de dexie-react-hooks
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn()
}))

// Mock nanoid para IDs previsíveis
let nanoIdCounter = 0
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => `mock-id-${nanoIdCounter++}`)
}))

// --- Test Suite ---

describe('useCustomChat Hook', () => {
  // Tipagem para mocks para melhor autocompletar
  const mockDb = db as jest.Mocked<typeof db>
  const mockAskQuestion = ChatService.askQuestion as jest.MockedFunction<
    typeof ChatService.askQuestion
  >
  const mockUseLiveQuery = useLiveQuery as jest.MockedFunction<
    typeof useLiveQuery
  >

  beforeEach(() => {
    // Resetar mocks e contador antes de cada teste
    jest.clearAllMocks()
    nanoIdCounter = 0
    // Configurar retorno padrão para useLiveQuery (geralmente lista vazia inicial)
    mockUseLiveQuery.mockReturnValue([])
  })

  it('should initialize with empty messages and not loading', () => {
    const { result } = renderHook(() => useCustomChat('existing-chat-id'))
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.currentChatId).toBe('existing-chat-id')
  })

  it('should load initial messages for an existing chatId', async () => {
    const initialMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        chatId: 'chat-load',
        role: 'user',
        content: 'Hello',
        createdAt: new Date()
      },
      {
        id: 'msg-2',
        chatId: 'chat-load',
        role: 'assistant',
        content: 'Hi there!',
        createdAt: new Date(),
        thread_id: 'thread-load'
      }
    ]
    // Configura o mock para retornar mensagens quando chamado com 'chat-load'
    mockUseLiveQuery.mockImplementation((query, deps) => {
      if (deps && deps[0] === 'chat-load') {
        return initialMessages
      }
      return []
    })

    const { result } = renderHook(() => useCustomChat('chat-load'))

    // Espera que as mensagens sejam definidas no estado
    await waitFor(() => {
      expect(result.current.messages).toEqual(initialMessages)
    })
  })

  // --- Testes para sendMessage (base) ---
  it('sendMessage: should add user message optimistically and call API', async () => {
    const { result } = renderHook(() => useCustomChat('chat-send'))
    const mockResponse: QuestionResponse = {
      answer: 'API Response',
      thread_id: 'thread-send-1'
    }
    mockAskQuestion.mockResolvedValue(mockResponse) // Mock da resposta da API

    await act(async () => {
      await result.current.sendMessage('Test query')
    })

    // 1. Mensagem do usuário adicionada optimisticamente
    expect(result.current.messages).toHaveLength(2) // User + Assistant
    expect(result.current.messages[0]).toMatchObject({
      id: 'mock-id-0', // Primeiro ID gerado
      role: 'user',
      content: 'Test query',
      chatId: 'thread-send-1' // ID atualizado após resposta
    })
    // 2. Loading state ativado e desativado
    expect(result.current.isLoading).toBe(false) // Deve ser false após a conclusão
    // 3. API foi chamada corretamente
    expect(mockAskQuestion).toHaveBeenCalledTimes(1)
    expect(mockAskQuestion).toHaveBeenCalledWith('Test query', 'chat-send') // threadId existente
    // 4. DB foi chamado para adicionar mensagem do usuário (com ID final) e do assistente
    expect(mockDb.addChatMessage).toHaveBeenCalledTimes(2)
  })

  it('sendMessage: should create new chat if chatId is "new"', async () => {
    const { result } = renderHook(() => useCustomChat('new')) // Inicia com 'new'
    const mockResponse: QuestionResponse = {
      answer: 'New chat answer',
      thread_id: 'new-thread-id'
    }
    mockAskQuestion.mockResolvedValue(mockResponse)

    await act(async () => {
      await result.current.sendMessage('First message')
    })

    // 1. API chamada com 'create'
    expect(mockAskQuestion).toHaveBeenCalledWith('First message', 'create')
    // 2. DB chamado para criar chat
    expect(mockDb.createChat).toHaveBeenCalledTimes(1)
    expect(mockDb.createChat).toHaveBeenCalledWith(
      'new-thread-id',
      expect.stringContaining('First message')
    ) // Verifica ID e título
    // 3. currentChatId atualizado
    expect(result.current.currentChatId).toBe('new-thread-id')
    // 4. Mensagens adicionadas ao DB e estado
    expect(mockDb.addChatMessage).toHaveBeenCalledTimes(2)
    expect(result.current.messages).toHaveLength(2) // User + Assistant
    expect(result.current.messages[1]).toMatchObject({
      // Verifica mensagem do assistente
      role: 'assistant',
      content: 'New chat answer',
      chatId: 'new-thread-id',
      thread_id: 'new-thread-id' // Verifica se o thread_id foi salvo
    })
  })

  // --- Testes específicos para submitQueryFromOutline ---

  it('submitQueryFromOutline: should add user message and call API with provided threadId', async () => {
    const { result } = renderHook(() => useCustomChat('existing-chat-id')) // Hook já inicializado com um chat
    const outlineText = 'Details for item 1'
    const outlineThreadId = 'thread-from-outline'
    const mockResponse: QuestionResponse = {
      answer: 'Response to outline query',
      thread_id: outlineThreadId
    } // API retorna o mesmo threadId

    mockAskQuestion.mockResolvedValue(mockResponse)

    await act(async () => {
      // Chama a função específica do outline
      await result.current.submitQueryFromOutline(outlineText, outlineThreadId)
    })

    // 1. Mensagem do usuário adicionada ao estado
    expect(result.current.messages).toHaveLength(2) // User (outline) + Assistant
    expect(result.current.messages[0]).toMatchObject({
      id: 'mock-id-0', // Primeiro ID gerado pelo nanoid mock
      role: 'user',
      content: outlineText,
      chatId: outlineThreadId // Deve usar o threadId fornecido e atualizado pós-resposta
    })

    // 2. API chamada com os dados corretos
    expect(mockAskQuestion).toHaveBeenCalledTimes(1)
    expect(mockAskQuestion).toHaveBeenCalledWith(outlineText, outlineThreadId)

    // 3. Mensagem do assistente adicionada ao estado e DB
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Response to outline query',
      chatId: outlineThreadId,
      thread_id: outlineThreadId // Verifica se thread_id da resposta foi salvo
    })
    expect(mockDb.addChatMessage).toHaveBeenCalledTimes(2) // User + Assistant
    expect(mockDb.createChat).not.toHaveBeenCalled() // Não deve criar um novo chat
  })

  it('submitQueryFromOutline: should handle API errors correctly', async () => {
    const { result } = renderHook(() => useCustomChat('error-chat-id'))
    const outlineText = 'Query that fails'
    const outlineThreadId = 'thread-error'
    const apiError = new Error('API Failed')

    mockAskQuestion.mockRejectedValue(apiError) // Mock da API falhando

    await act(async () => {
      await result.current.submitQueryFromOutline(outlineText, outlineThreadId)
    })

    // 1. Estado de erro definido
    expect(result.current.error).toBe(apiError)
    // 2. Mensagem do usuário otimista removida
    expect(result.current.messages).toHaveLength(0)
    // 3. Loading desativado
    expect(result.current.isLoading).toBe(false)
    // 4. DB não deve ter sido chamado para adicionar mensagens
    // A implementação atual adiciona o usuário antes da chamada à API, então não é removido do DB no erro.
    // Poderia ser melhorado para adicionar ao DB apenas após sucesso da API.
    // Por enquanto, verificamos que a msg do assistente não foi adicionada:
    expect(mockDb.addChatMessage).toHaveBeenCalledTimes(0)
  })

  it('clearChat: should call db.clearChatMessages and clear state', async () => {
    const chatIdToClear = 'chat-to-clear'
    // Pre-load state for the test
    mockUseLiveQuery.mockImplementation((query, deps) => {
      if (deps && deps[0] === chatIdToClear) {
        return [
          {
            id: 'msg-clear',
            chatId: chatIdToClear,
            role: 'user',
            content: 'abc',
            createdAt: new Date()
          }
        ]
      }
      return []
    })

    const { result } = renderHook(() => useCustomChat(chatIdToClear))

    // Wait for initial message to load
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
    })

    await act(async () => {
      await result.current.clearChat()
    })

    expect(mockDb.clearChatMessages).toHaveBeenCalledTimes(1)
    expect(mockDb.clearChatMessages).toHaveBeenCalledWith(chatIdToClear)
    expect(result.current.messages).toHaveLength(0) // State should be cleared
  })

  // Adicionar mais testes:
  // - Tratamento de erros na API para sendMessage normal
  // - ... outros casos de borda
})
