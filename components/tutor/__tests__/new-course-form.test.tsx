import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTranslator } from '@/lib/i18n/translate'
import { DEFAULT_TUTOR_LIMITS } from '@/lib/tutor/limits'
import type { TutorDocument } from '@/lib/tutor/types'

import { uploadTutorFile } from '../api'
import { NewCourseForm } from '../new-course-form'

const state = vi.hoisted(() => ({ locale: 'en' as 'en' | 'zh-CN' }))
vi.mock('@/components/language-provider', () => ({
  useI18n: () => ({ locale: state.locale, t: createTranslator(state.locale) })
}))
vi.mock('@/components/ui/icons', () => ({ IconBlinkingLogo: () => <div /> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../api', async importOriginal => ({
  ...(await importOriginal<typeof import('../api')>()),
  uploadTutorFile: vi.fn()
}))

const capabilities = { ...DEFAULT_TUTOR_LIMITS, ready: true, missing: [] }
const fetchMock = vi.fn()
const uploadMock = vi.mocked(uploadTutorFile)
const response = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload
})
const document = (overrides: Partial<TutorDocument> = {}): TutorDocument => ({
  id: 'document-1',
  filename: 'notes.txt',
  size: 4,
  pageCount: 1,
  status: 'parsed',
  tokenCount: 12,
  chunkCount: 1,
  error: null,
  ...overrides
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function choose(files: File[]) {
  fireEvent.change(
    screen.getByLabelText(
      createTranslator(state.locale)('Upload learning materials')
    ),
    { target: { files } }
  )
}
function goal() {
  fireEvent.change(screen.getByLabelText('What are you learning for?'), {
    target: { value: 'Learn these notes' }
  })
}
function submit() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Build my learning path' })
  )
}
function sizedFile(name: string, size: number) {
  const file = new File(['text'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  state.locale = 'en'
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  uploadMock.mockReset().mockResolvedValue({ document: document() })
  vi.mocked(toast.error).mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Tutor course creation', () => {
  it('uses Chinese labels and the new default limits before capabilities load', () => {
    state.locale = 'zh-CN'
    render(<NewCourseForm capabilities={null} onCreated={vi.fn()} />)
    expect(
      screen.getByRole('heading', { name: '从收藏到行动！现在上传文件。' })
    ).toBeInTheDocument()
    expect(screen.getByText(/最多 20 份文件 · 每份 20 MB/)).toBeInTheDocument()
    expect(screen.getByText(/总计 200 MB/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择文件' })).toBeEnabled()
  })

  it.each(['en', 'zh-CN'] as const)(
    'reports missing setup on an empty form in %s',
    locale => {
      state.locale = locale
      const onCreateFailed = vi.fn()
      const t = createTranslator(locale)
      render(
        <NewCourseForm
          capabilities={{ ...capabilities, ready: false }}
          onCreated={vi.fn()}
          onCreateFailed={onCreateFailed}
        />
      )
      fireEvent.click(
        screen.getByRole('button', { name: t('Build my learning path') })
      )
      expect(toast.error).toHaveBeenCalledWith(
        t('The AI service is not configured correctly. Please try again later.')
      )
      expect(onCreateFailed).toHaveBeenCalledOnce()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('explains missing files, incomplete upload, and missing goal', async () => {
    const pending = deferred<{ document: TutorDocument }>()
    uploadMock.mockReturnValueOnce(pending.promise)
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    submit()
    expect(toast.error).toHaveBeenLastCalledWith(
      'Add a document before creating a learning route.'
    )
    choose([new File(['text'], 'notes.txt')])
    submit()
    expect(toast.error).toHaveBeenLastCalledWith(
      'Wait for your files to finish uploading.'
    )
    await act(async () => pending.resolve({ document: document() }))
    submit()
    expect(toast.error).toHaveBeenLastCalledWith('Enter your learning goal.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts the valid files in a mixed batch and identifies every rejected file', async () => {
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    choose([
      new File(['image'], 'image.png'),
      new File(['notes'], 'good.md'),
      new File([], 'empty.txt'),
      sizedFile('big.pdf', 21 * 1024 * 1024)
    ])
    await screen.findByText('Ready to use')
    expect(uploadMock).toHaveBeenCalledOnce()
    expect(uploadMock.mock.calls[0][0].name).toBe('good.md')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'image.png: Please upload'
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'empty.txt: Each file must be non-empty'
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'big.pdf: Each file must be non-empty and no larger than 20 MB'
    )
  })

  it('accepts files up to the count limit across successive drops', async () => {
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, maxFiles: 2 }}
        onCreated={vi.fn()}
      />
    )
    choose([new File(['a'], 'a.md')])
    await screen.findByText('Ready to use')
    fireEvent.drop(
      screen.getByLabelText('Upload learning materials').parentElement!,
      {
        dataTransfer: {
          files: [new File(['b'], 'b.md'), new File(['c'], 'c.md')]
        }
      }
    )
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'c.md: Choose up to 2 files.'
    )
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDisabled()
  })

  it('continues after a file exceeds the total byte budget and accepts smaller files', async () => {
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, maxCourseSize: 10 }}
        onCreated={vi.fn()}
      />
    )
    choose([
      sizedFile('a.md', 6),
      sizedFile('large.md', 7),
      sizedFile('b.md', 4)
    ])
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2))
    expect(uploadMock.mock.calls.map(call => call[0].name)).toEqual([
      'a.md',
      'b.md'
    ])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'large.md: Course files exceed'
    )
  })

  it.each([
    'notes.pdf',
    'notes.txt',
    'notes.md',
    'notes.markdown',
    'notes.DOCX'
  ])('supports dropping %s with stale service readiness', async name => {
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, ready: false }}
        onCreated={vi.fn()}
      />
    )
    const dropzone = screen.getByLabelText(
      'Upload learning materials'
    ).parentElement!
    const file = new File(['material'], name)
    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('bg-accent')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    await screen.findByText('Ready to use')
    expect(dropzone).not.toHaveClass('bg-accent')
    expect(uploadMock.mock.calls[0][0]).toBe(file)
  })

  it('creates a course with goal, level, locale and unique document IDs', async () => {
    const onCreated = vi.fn()
    const pending = deferred<ReturnType<typeof response>>()
    fetchMock.mockReturnValueOnce(pending.promise)
    render(<NewCourseForm capabilities={capabilities} onCreated={onCreated} />)
    choose([new File(['text'], 'notes.txt'), new File(['text'], 'copy.txt')])
    await waitFor(() =>
      expect(screen.getAllByText('Ready to use')).toHaveLength(2)
    )
    goal()
    fireEvent.click(screen.getByLabelText('Some experience'))
    submit()
    expect(
      screen.getByRole('button', { name: 'Creating your course…' })
    ).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tutor/courses')
    expect(JSON.parse(options.body)).toEqual({
      documentIds: ['document-1'],
      goal: 'Learn these notes',
      level: 'intermediate',
      locale: 'en'
    })
    expect(options.headers.get('x-morphic-locale')).toBe('en')
    await act(async () =>
      pending.resolve(response({ course: { id: 'course-1' } }))
    )
    expect(onCreated).toHaveBeenCalledWith({ id: 'course-1' })
  })

  it('still submits against the server when readiness is stale', async () => {
    const onCreateFailed = vi.fn()
    fetchMock.mockResolvedValueOnce(
      response({ error: 'Service unavailable' }, 503)
    )
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, ready: false }}
        onCreated={vi.fn()}
        onCreateFailed={onCreateFailed}
      />
    )
    choose([new File(['text'], 'notes.txt')])
    await screen.findByText('Ready to use')
    goal()
    submit()
    await waitFor(() => expect(onCreateFailed).toHaveBeenCalledOnce())
    expect(toast.error).toHaveBeenLastCalledWith('Service unavailable')
  })

  it.each([{ maxPages: 1 }, { maxCourseTokens: 15 }, { maxCourseChunks: 1 }])(
    'blocks a parsed batch exceeding %j and recovers when a file is removed',
    async budget => {
      uploadMock.mockImplementation(async file => ({
        document: document({ id: file.name, filename: file.name })
      }))
      render(
        <NewCourseForm
          capabilities={{ ...capabilities, ...budget }}
          onCreated={vi.fn()}
        />
      )
      choose([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')])
      await screen.findByText(
        /These materials exceed the course processing budget/
      )
      expect(
        screen.getByRole('button', { name: 'Build my learning path' })
      ).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Remove b.txt' }))
      expect(
        screen.getByRole('button', { name: 'Build my learning path' })
      ).toBeEnabled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )
})

describe('Tutor upload queue', () => {
  it('starts at most three uploads and refills a slot when an upload completes', async () => {
    const jobs = Array.from({ length: 5 }, () =>
      deferred<{ document: TutorDocument }>()
    )
    jobs.forEach(job => uploadMock.mockReturnValueOnce(job.promise))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    choose(jobs.map((_, i) => new File(['text'], `${i}.txt`)))
    expect(uploadMock).toHaveBeenCalledTimes(3)
    expect(screen.getAllByText('Waiting to upload')).toHaveLength(2)
    await act(async () => jobs[0].resolve({ document: document() }))
    expect(uploadMock).toHaveBeenCalledTimes(4)
    expect(screen.getAllByText('Waiting to upload')).toHaveLength(1)
  })

  it('renders actual progress, cancels the request and can retry it', async () => {
    uploadMock.mockImplementationOnce(
      (_file, _locale, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError'))
          )
        })
    )
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, uploadConcurrency: 1 }}
        onCreated={vi.fn()}
      />
    )
    choose([new File(['text'], 'notes.txt')])
    const [, , signal, progress] = uploadMock.mock.calls[0]
    act(() => progress(57))
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '57')
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel upload of notes.txt' })
      )
    )
    expect(signal.aborted).toBe(true)
    expect(screen.getByText('Upload cancelled')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Ready to use')
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('cancels queued files without starting a request', async () => {
    uploadMock.mockReturnValue(new Promise(() => {}))
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, uploadConcurrency: 1 }}
        onCreated={vi.fn()}
      />
    )
    choose([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')])
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel upload of b.txt' })
    )
    expect(uploadMock).toHaveBeenCalledOnce()
    expect(screen.getByText('Upload cancelled')).toBeInTheDocument()
  })

  it('aborts removed uploads and ignores their late responses', async () => {
    const job = deferred<{ document: TutorDocument }>()
    uploadMock.mockReturnValueOnce(job.promise)
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    choose([new File(['text'], 'notes.txt')])
    const signal = uploadMock.mock.calls[0][2]
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }))
    expect(signal.aborted).toBe(true)
    await act(async () =>
      job.resolve({ document: document({ status: 'uploaded' }) })
    )
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries only the failed upload, retaining successful files', async () => {
    uploadMock.mockRejectedValueOnce(new Error('Upload failed'))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    choose([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')])
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.getAllByText('Ready to use')).toHaveLength(2)
    )
    expect(uploadMock.mock.calls.map(call => call[0].name)).toEqual([
      'a.txt',
      'b.txt',
      'a.txt'
    ])
  })

  it('aborts active requests on unmount', () => {
    uploadMock.mockReturnValueOnce(new Promise(() => {}))
    const view = render(
      <NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />
    )
    choose([new File(['text'], 'notes.txt')])
    const signal = uploadMock.mock.calls[0][2]
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
})

describe('Tutor document preflight', () => {
  it('polls upload and parsing states, shows metrics, then allows course creation', async () => {
    vi.useFakeTimers()
    uploadMock.mockResolvedValueOnce({
      document: document({
        status: 'uploaded',
        pageCount: null,
        tokenCount: null
      })
    })
    fetchMock
      .mockResolvedValueOnce(
        response({ document: document({ status: 'parsing', pageCount: null }) })
      )
      .mockResolvedValueOnce(response({ document: document() }))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    await act(async () => choose([new File(['text'], 'notes.txt')]))
    expect(
      screen.getByText('Uploaded · waiting to process')
    ).toBeInTheDocument()
    goal()
    submit()
    expect(toast.error).toHaveBeenLastCalledWith(
      'Wait for your files to finish processing.'
    )
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByText('Processing…')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByText('Ready to use')).toBeInTheDocument()
    expect(screen.getByText('1 text segments · 12 tokens')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(6000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a failed parse without uploading the file again', async () => {
    uploadMock.mockResolvedValueOnce({
      document: document({ status: 'failed', error: 'Cannot read this file' })
    })
    fetchMock.mockResolvedValueOnce(response({ document: document() }))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    choose([new File(['text'], 'notes.txt')])
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await screen.findByText('Ready to use')
    expect(uploadMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tutor/documents/document-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('allows a failed status request to resume polling without reparsing', async () => {
    vi.useFakeTimers()
    uploadMock.mockResolvedValueOnce({
      document: document({ status: 'uploaded' })
    })
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ document: document() }))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    await act(async () => choose([new File(['text'], 'notes.txt')]))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    )
    expect(screen.getByText('Ready to use')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][1].method).toBe('GET')
    expect(uploadMock).toHaveBeenCalledOnce()
  })

  it('cleans up polling timers when the file is removed', async () => {
    vi.useFakeTimers()
    uploadMock.mockResolvedValueOnce({
      document: document({ status: 'uploaded' })
    })
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    await act(async () => choose([new File(['text'], 'notes.txt')]))
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }))
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aborts in-flight polling and ignores late replies after unmount', async () => {
    vi.useFakeTimers()
    uploadMock.mockResolvedValueOnce({
      document: document({ status: 'uploaded' })
    })
    const pending = deferred<ReturnType<typeof response>>()
    fetchMock.mockReturnValueOnce(pending.promise)
    const view = render(
      <NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />
    )
    await act(async () => choose([new File(['text'], 'notes.txt')]))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    const signal = fetchMock.mock.calls[0][1].signal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () =>
      pending.resolve(response({ document: document({ status: 'parsing' }) }))
    )
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
