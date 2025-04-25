import { ChatMessage } from '@/lib/db'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { AnswerSection, AnswerSectionProps } from '../answer-section'

// Mock dos componentes filhos
// Usamos um nome descritivo para o mock para facilitar a depuração
jest.mock('../message', () => ({
  BotMessage: jest.fn(({ message }) => (
    <div data-testid="mock-bot-message">{message}</div>
  ))
}))
jest.mock('../outline-box', () => {
  // Mock default export
  const MockOutlineBox = jest.fn(({ outlineText, threadId, onItemClick }) => (
    <div
      data-testid="mock-outline-box"
      data-thread-id={threadId}
      onClick={() => onItemClick('mock-click', threadId)}
    >
      {outlineText}
    </div>
  ))
  return MockOutlineBox
})
jest.mock('../message-actions', () => ({
  MessageActions: jest.fn(() => (
    <div data-testid="mock-message-actions">Actions</div>
  ))
}))
jest.mock('../collapsible-message', () => ({
  // Mock CollapsibleMessage para apenas renderizar children
  CollapsibleMessage: jest.fn(({ children }) => <>{children}</>)
}))
jest.mock('../default-skeleton', () => ({
  DefaultSkeleton: jest.fn(() => (
    <div data-testid="mock-skeleton">Loading...</div>
  ))
}))

// Helper para criar mock messages
const createMockMessage = (
  content: string,
  thread_id?: string
): ChatMessage => ({
  id: `msg-${Math.random()}`,
  chatId: 'chat-1',
  role: 'assistant',
  content,
  createdAt: new Date(),
  thread_id: thread_id
})

describe('AnswerSection Component', () => {
  let mockOnOutlineItemClick: jest.Mock
  let defaultProps: Omit<AnswerSectionProps, 'message'>

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    mockOnOutlineItemClick = jest.fn()
    defaultProps = {
      isOpen: true,
      onOpenChange: jest.fn(),
      onOutlineItemClick: mockOnOutlineItemClick,
      showActions: true
    }
  })

  it('should render BotMessage with full content when no outline marker is present', () => {
    const message = createMockMessage('This is a simple answer.', 'thread-1')
    render(<AnswerSection {...defaultProps} message={message} />)

    const botMessage = screen.getByTestId('mock-bot-message')
    expect(botMessage).toBeInTheDocument()
    expect(botMessage).toHaveTextContent('This is a simple answer.')
    expect(screen.queryByTestId('mock-outline-box')).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-message-actions')).toBeInTheDocument()
  })

  it('should render BotMessage with main content and OutlineBox when outline marker is present', () => {
    const message = createMockMessage(
      'Main answer content. @@outline 1. Option 1\n2. Option 2',
      'thread-2'
    )
    render(<AnswerSection {...defaultProps} message={message} />)

    const botMessage = screen.getByTestId('mock-bot-message')
    expect(botMessage).toBeInTheDocument()
    expect(botMessage).toHaveTextContent('Main answer content.') // Somente conteúdo principal

    const outlineBox = screen.getByTestId('mock-outline-box')
    expect(outlineBox).toBeInTheDocument()
    expect(outlineBox).toHaveTextContent('1. Option 1')
    expect(outlineBox).toHaveTextContent('2. Option 2')
    expect(outlineBox).toHaveAttribute('data-thread-id', 'thread-2')

    // Verifica se a prop onItemClick foi passada corretamente (o mock do OutlineBox a chama)
    // fireEvent.click(outlineBox) // Simula o clique no mock do OutlineBox
    // expect(mockOnOutlineItemClick).toHaveBeenCalledWith('mock-click', 'thread-2');

    expect(screen.getByTestId('mock-message-actions')).toBeInTheDocument()
  })

  it('should NOT render OutlineBox if marker is present but thread_id is missing', () => {
    const message = createMockMessage(
      'Answer with outline marker @@outline But no thread_id'
      // thread_id is undefined
    )
    render(<AnswerSection {...defaultProps} message={message} />)

    const botMessage = screen.getByTestId('mock-bot-message')
    expect(botMessage).toBeInTheDocument()
    expect(botMessage).toHaveTextContent('Answer with outline marker')
    expect(screen.queryByTestId('mock-outline-box')).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-message-actions')).toBeInTheDocument()
  })

  it('should render DefaultSkeleton when content is empty or null', () => {
    const message = createMockMessage('', 'thread-3') // Empty content
    render(<AnswerSection {...defaultProps} message={message} />)
    expect(screen.getByTestId('mock-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-bot-message')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-outline-box')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-message-actions')).not.toBeInTheDocument()
  })

  it('should hide MessageActions when showActions is false', () => {
    const message = createMockMessage('Simple answer', 'thread-4')
    render(
      <AnswerSection {...defaultProps} message={message} showActions={false} />
    )

    expect(screen.getByTestId('mock-bot-message')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-message-actions')).not.toBeInTheDocument()
  })

  it('should show MessageActions when showActions is true (or default)', () => {
    const message = createMockMessage('Another simple answer', 'thread-5')
    render(
      <AnswerSection {...defaultProps} message={message} showActions={true} />
    )

    expect(screen.getByTestId('mock-bot-message')).toBeInTheDocument()
    expect(screen.getByTestId('mock-message-actions')).toBeInTheDocument()
  })
})
