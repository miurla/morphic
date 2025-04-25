import '@testing-library/jest-dom' // Para matchers extras
import { fireEvent, render, screen } from '@testing-library/react'
import OutlineBox from '../outline-box' // Ajuste o caminho se necessário

describe('OutlineBox Component', () => {
  const mockThreadId = 'thread-123'
  let mockOnItemClick: jest.Mock // Definir tipo como jest.Mock

  // Reinicializar o mock antes de cada teste
  beforeEach(() => {
    mockOnItemClick = jest.fn()
  })

  it('should render the title correctly', () => {
    render(
      <OutlineBox
        outlineText="1. Item 1" // Precisa de algum texto para renderizar
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )
    expect(
      screen.getByText('Clique em um item para detalhar:')
    ).toBeInTheDocument()
  })

  it('should render list items correctly from outlineText', () => {
    const outline =
      '1. First item\n2. Second item with details\n  2.1 Indented item'
    render(
      <OutlineBox
        outlineText={outline}
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )

    // Verifica se os itens principais (trimados) estão lá
    expect(
      screen.getByRole('button', { name: '1. First item' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '2. Second item with details' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '2.1 Indented item' })
    ).toBeInTheDocument()

    // Verifica a quantidade total de itens renderizados
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('should filter out empty lines', () => {
    const outline = '\n1. Valid item\n\n\n2. Another valid item\n '
    render(
      <OutlineBox
        outlineText={outline}
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )
    expect(
      screen.getByRole('button', { name: '1. Valid item' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '2. Another valid item' })
    ).toBeInTheDocument()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2) // Apenas 2 botões devem ser renderizados
  })

  it('should return null if outlineText results in no items', () => {
    const outline = '\n  \n '
    const { container } = render(
      <OutlineBox
        outlineText={outline}
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )
    // O container deve estar vazio pois o componente retorna null
    expect(container.firstChild).toBeNull()
  })

  it('should call onItemClick with correct arguments when an item is clicked', () => {
    const outline = 'Action: Summarize the text'
    const expectedText = 'Action: Summarize the text' // Texto exato
    render(
      <OutlineBox
        outlineText={outline}
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )

    const itemButton = screen.getByRole('button', { name: expectedText })
    fireEvent.click(itemButton)

    // Verifica se o mock foi chamado
    expect(mockOnItemClick).toHaveBeenCalledTimes(1)
    // Verifica se foi chamado com os argumentos corretos
    expect(mockOnItemClick).toHaveBeenCalledWith(expectedText, mockThreadId)
  })

  it('should handle item text with leading/trailing spaces correctly for click', () => {
    const outline = '  Item with spaces  '
    const expectedText = 'Item with spaces' // Texto trimado é usado internamente e no botão
    render(
      <OutlineBox
        outlineText={outline}
        threadId={mockThreadId}
        onItemClick={mockOnItemClick}
      />
    )

    const itemButton = screen.getByRole('button', { name: expectedText })
    fireEvent.click(itemButton)

    expect(mockOnItemClick).toHaveBeenCalledTimes(1)
    // A função de callback deve ser chamada com o texto *exato* do botão (que foi trimado na renderização)
    expect(mockOnItemClick).toHaveBeenCalledWith(expectedText, mockThreadId)
  })
})
