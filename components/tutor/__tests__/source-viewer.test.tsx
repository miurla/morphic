import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SourceCitation } from '@/lib/tutor/types'

import SourceViewer from '../source-viewer'

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }))
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument
}))

const source: SourceCitation = {
  id: 'source-1',
  documentId: 'document/1',
  filename: 'notes.pdf',
  quote: 'A transaction is atomic.\n<script>alert("text only")</script>',
  regions: [{ page: 4, x: 0, y: 0, width: 1, height: 1 }]
}

describe('Tutor original sources', () => {
  beforeEach(() => {
    getDocument.mockReset()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each(['txt', 'md', 'markdown', 'docx'])(
    'shows the cited text and original %s download without invoking PDF.js',
    extension => {
      const filename = `notes.${extension}`
      render(
        <SourceViewer source={{ ...source, filename }} onClose={vi.fn()} />
      )

      const quote = screen.getByText(/A transaction is atomic/)
      expect(quote.textContent).toBe(source.quote)
      expect(quote.querySelector('script')).toBeNull()
      expect(
        screen.getByRole('link', { name: 'Download original file' })
      ).toHaveAttribute('href', '/api/tutor/documents/document%2F1/file')
      expect(
        screen.getByRole('link', { name: 'Download original file' })
      ).toHaveAttribute('download', filename)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Next page' })
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(getDocument).not.toHaveBeenCalled()
    }
  )

  it('still loads PDF sources and preserves their original-page fallback link', async () => {
    getDocument.mockImplementation(() => ({
      promise: Promise.reject(new Error('Unavailable PDF')),
      destroy: vi.fn()
    }))
    render(<SourceViewer source={source} onClose={vi.fn()} />)

    await waitFor(() =>
      expect(getDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/tutor/documents/document%2F1/file'
        })
      )
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PDF preview could not be loaded.'
    )
    expect(
      screen.getByRole('link', { name: 'Open original PDF' })
    ).toHaveAttribute('href', '/api/tutor/documents/document%2F1/file#page=4')
  })
})
