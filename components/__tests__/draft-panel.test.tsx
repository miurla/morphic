import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { saveNote } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'

import { DraftPanel } from '../draft/draft-panel'
import { useLiveDraftBlock } from '../draft/draft-store'

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

vi.mock('@/lib/actions/notes', () => ({
  saveNote: vi.fn()
}))

const upsertCachedNote = vi.fn()
vi.mock('../library/library-context', () => ({
  useLibrary: () => ({ openLibrary: vi.fn(), upsertCachedNote })
}))

vi.mock('../artifact/artifact-context', () => ({
  useArtifact: () => ({ close: vi.fn() })
}))

vi.mock('../message', () => ({
  MarkdownMessage: ({ message }: { message: string }) => <div>{message}</div>
}))

const draft =
  '````draft\ntitle: Boards\n\n# Cutting boards\n\nOil monthly.\n````'
const store = {
  messages: [
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: draft }] }
  ],
  isStreaming: false,
  quote: null,
  chatId: 'chat-1',
  isGuest: false,
  isCloudDeployment: false,
  libraryAvailable: true
}
vi.mock('../draft/draft-store', () => ({
  useDraftStore: () => store,
  useLiveDraftBlock: vi.fn(() => null)
}))

describe('DraftPanel save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('saves the shown version as a note', async () => {
    const note = { id: 'n1' }
    vi.mocked(saveNote).mockResolvedValue({ success: true, note } as never)

    render(<DraftPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

    await waitFor(() => expect(upsertCachedNote).toHaveBeenCalledWith(note))
    expect(saveNote).toHaveBeenCalledWith({
      title: 'Cutting boards',
      content: '# Cutting boards\n\nOil monthly.',
      chatId: 'chat-1',
      sourceMessageId: 'a1'
    })
    expect(captureClient).toHaveBeenCalledWith(
      'note_saved',
      expect.objectContaining({ source: 'draft_panel', chatId: 'chat-1' })
    )
  })

  test('is disabled while a draft is streaming', () => {
    vi.mocked(useLiveDraftBlock).mockReturnValueOnce({
      title: 'Boards',
      content: '# Cutting',
      closed: false
    })

    render(<DraftPanel />)

    expect(
      screen.getByRole('button', { name: 'Save to library' })
    ).toBeDisabled()
  })
})
