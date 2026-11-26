// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startDocumentPreparation: vi.fn(),
  getDocument: vi.fn(),
  getDocumentParse: vi.fn(),
  updateDocument: vi.fn(),
  saveDocumentParse: vi.fn(),
  parse: vi.fn()
}))
vi.mock('../repository', () => mocks)
vi.mock('../parse-isolated', () => ({ parseDocumentIsolated: mocks.parse }))
import { prepareDocument } from '../preparation'

const parsed = {
  pageCount: 1,
  blocks: [
    {
      text: 'Transactions are atomic.',
      region: { page: 1, x: 0, y: 0, width: 1, height: 1 }
    }
  ],
  warnings: []
}
const document = {
  id: 'd',
  filename: 'a.txt',
  status: 'uploaded',
  contentHash: 'hash',
  tokenCount: null,
  chunkCount: null
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getDocument.mockResolvedValue({ ...document })
  mocks.getDocumentParse.mockResolvedValue(null)
  mocks.parse.mockResolvedValue({
    parsed,
    chunks: [],
    tokenCount: 5,
    chunkCount: 1
  })
})

afterEach(() => vi.unstubAllEnvs())

describe('document preparation', () => {
  it('restores pending metadata from a valid cache after a worker interruption', async () => {
    mocks.getDocument.mockResolvedValue({
      ...document,
      status: 'parsing',
      tokenCount: 5,
      chunkCount: 1
    })
    mocks.getDocumentParse.mockResolvedValue({ ...parsed, chunks: [] })
    await prepareDocument('alice', 'd')
    expect(mocks.parse).not.toHaveBeenCalled()
    expect(mocks.saveDocumentParse).toHaveBeenCalledOnce()
  })
  it('checks current character and PDF page budgets when reusing cached parsing', async () => {
    mocks.getDocument.mockResolvedValue({
      ...document,
      filename: 'a.pdf',
      status: 'parsed',
      tokenCount: 5,
      chunkCount: 1
    })
    mocks.getDocumentParse.mockResolvedValue({
      ...parsed,
      pageCount: 3,
      chunks: []
    })
    vi.stubEnv('TUTOR_MAX_PDF_PAGES', '2')
    await expect(prepareDocument('alice', 'd')).rejects.toMatchObject({
      code: 'PDF_PAGE_LIMIT'
    })
    vi.stubEnv('TUTOR_MAX_PDF_PAGES', '500')
    vi.stubEnv('TUTOR_MAX_TEXT_CHARACTERS', '5')
    await expect(prepareDocument('alice', 'd')).rejects.toMatchObject({
      code: 'DOCUMENT_TEXT_LIMIT'
    })
    expect(mocks.parse).not.toHaveBeenCalled()
  })
  it('claims an obsolete cache before reparsing so failures can be published', async () => {
    mocks.getDocument.mockResolvedValue({
      ...document,
      status: 'parsed',
      tokenCount: 5,
      chunkCount: 1
    })
    mocks.getDocumentParse.mockResolvedValue(null)
    mocks.parse.mockRejectedValueOnce(new Error('obsolete parser failed'))
    await expect(prepareDocument('alice', 'd')).rejects.toThrow()
    expect(mocks.startDocumentPreparation).toHaveBeenCalledWith(
      'alice',
      'd',
      expect.stringContaining('preparation-v2')
    )
    expect(mocks.updateDocument).toHaveBeenCalledWith(
      'alice',
      'd',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('records failure even when cache lookup fails before parsing starts', async () => {
    mocks.getDocumentParse.mockRejectedValueOnce(
      new Error('database connection lost')
    )
    await expect(prepareDocument('alice', 'd')).rejects.toThrow(
      'database connection lost'
    )
    expect(mocks.updateDocument).toHaveBeenCalledWith(
      'alice',
      'd',
      expect.objectContaining({ status: 'failed' })
    )
    expect(mocks.parse).not.toHaveBeenCalled()
  })
  it('publishes parsed content and metrics once for concurrent local requests', async () => {
    const [a, b] = await Promise.all([
      prepareDocument('alice', 'd'),
      prepareDocument('alice', 'd')
    ])
    expect(a).toEqual(b)
    expect(mocks.parse).toHaveBeenCalledOnce()
    expect(mocks.saveDocumentParse).toHaveBeenCalledWith(
      'alice',
      'd',
      expect.objectContaining({
        parsed,
        tokenCount: 5,
        chunkCount: 1,
        contentHash: 'hash'
      })
    )
  })
  it('reuses persisted parsing without reading or parsing the original file', async () => {
    mocks.getDocument.mockResolvedValue({
      ...document,
      status: 'parsed',
      tokenCount: 5,
      chunkCount: 1
    })
    mocks.getDocumentParse.mockResolvedValue({ ...parsed, chunks: [] })
    expect(await prepareDocument('alice', 'd')).toEqual({
      parsed,
      chunks: [],
      tokenCount: 5,
      chunkCount: 1
    })
    expect(mocks.parse).not.toHaveBeenCalled()
    expect(mocks.saveDocumentParse).not.toHaveBeenCalled()
  })
  it('leaves an existing index ready', async () => {
    mocks.getDocument.mockResolvedValue({ ...document, status: 'ready' })
    expect(await prepareDocument('alice', 'd')).toBeNull()
    expect(mocks.updateDocument).not.toHaveBeenCalled()
    expect(mocks.parse).not.toHaveBeenCalled()
  })
  it('records a safe error and allows a later retry', async () => {
    mocks.parse.mockRejectedValueOnce(new Error('secret provider credentials'))
    await expect(prepareDocument('alice', 'd')).rejects.toThrow()
    expect(JSON.stringify(mocks.updateDocument.mock.calls)).not.toContain(
      'secret'
    )
    expect(mocks.saveDocumentParse).not.toHaveBeenCalled()
    await prepareDocument('alice', 'd')
    expect(mocks.parse).toHaveBeenCalledTimes(2)
  })
  it('does not parse an unowned document', async () => {
    mocks.getDocument.mockResolvedValue(null)
    await expect(prepareDocument('bob', 'd')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    expect(mocks.parse).not.toHaveBeenCalled()
  })
})
