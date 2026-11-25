import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTranslator } from '@/lib/i18n/translate'

import { NewCourseForm } from '../new-course-form'

const state = vi.hoisted(() => ({ locale: 'en' as 'en' | 'zh-CN' }))
vi.mock('@/components/language-provider', () => ({
  useI18n: () => ({ locale: state.locale, t: createTranslator(state.locale) })
}))
vi.mock('@/components/ui/icons', () => ({ IconBlinkingLogo: () => <div /> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const capabilities = {
  ready: true,
  missing: [],
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 5
}
const fetchMock = vi.fn()

describe('Tutor course creation', () => {
  beforeEach(() => {
    state.locale = 'en'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the selected language and omits the original chat shortcuts', () => {
    state.locale = 'zh-CN'
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    expect(
      screen.getByRole('heading', { name: '从收藏到行动！现在上传文件。' })
    ).toBeInTheDocument()
    expect(screen.getByText('你的学习目标是什么？')).toBeInTheDocument()
    expect(screen.queryByText('Decide')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成学习路线' })).toBeEnabled()
  })

  it.each(['en', 'zh-CN'] as const)(
    'shows the normal configuration error when an empty form is submitted in %s',
    locale => {
      state.locale = locale
      const t = createTranslator(locale)
      const onCreateFailed = vi.fn()
      render(
        <NewCourseForm
          capabilities={{ ...capabilities, ready: false, missing: ['model'] }}
          onCreated={vi.fn()}
          onCreateFailed={onCreateFailed}
        />
      )
      const submit = screen.getByRole('button', {
        name: t('Build my learning path')
      })
      expect(submit).toBeEnabled()
      expect(submit.closest('form')).toHaveAttribute('novalidate')
      fireEvent.click(submit)
      expect(toast.error).toHaveBeenCalledWith(
        t('The AI service is not configured correctly. Please try again later.')
      )
      expect(onCreateFailed).toHaveBeenCalledOnce()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.each([capabilities, null])(
    'explains that a document is needed instead of disabling an empty form (%j)',
    currentCapabilities => {
      render(
        <NewCourseForm capabilities={currentCapabilities} onCreated={vi.fn()} />
      )
      const submit = screen.getByRole('button', {
        name: 'Build my learning path'
      })
      expect(submit).toBeEnabled()
      fireEvent.click(submit)
      expect(toast.error).toHaveBeenCalledWith(
        'Add a document before creating a learning route.'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('explains that uploads are still running when the enabled submit button is clicked', () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {}))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [new File(['text'], 'notes.txt')] }
    })
    fireEvent.change(screen.getByLabelText('What are you learning for?'), {
      target: { value: 'Learn these notes' }
    })
    expect(screen.getByText('Uploading…')).toBeInTheDocument()
    const submit = screen.getByRole('button', {
      name: 'Build my learning path'
    })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(toast.error).toHaveBeenCalledWith(
      'Wait for your files to finish uploading.'
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tutor/documents')
  })

  it('asks to retry failed uploads instead of silently blocking course creation', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Upload failed' })
    })
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [new File(['text'], 'notes.txt')] }
    })
    await screen.findByRole('button', { name: 'Retry' })
    vi.mocked(toast.error).mockClear()
    const submit = screen.getByRole('button', {
      name: 'Build my learning path'
    })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(toast.error).toHaveBeenCalledWith(
      'Retry or remove failed uploads before creating a learning route.'
    )
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('asks for a learning goal after a successful upload without sending an invalid course request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        document: { id: 'document-1', filename: 'notes.txt' }
      })
    })
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [new File(['text'], 'notes.txt')] }
    })
    await screen.findByText('Uploaded')
    fireEvent.change(screen.getByLabelText('What are you learning for?'), {
      target: { value: '   ' }
    })
    const submit = screen.getByRole('button', {
      name: 'Build my learning path'
    })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(toast.error).toHaveBeenCalledWith('Enter your learning goal.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('disables submission only while the course creation request is in flight', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'document-1', filename: 'notes.txt' }
        })
      })
      .mockReturnValueOnce(new Promise(() => {}))
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [new File(['text'], 'notes.txt')] }
    })
    await screen.findByText('Uploaded')
    fireEvent.change(screen.getByLabelText('What are you learning for?'), {
      target: { value: 'Learn these notes' }
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Build my learning path' })
    )
    const submit = screen.getByRole('button', { name: 'Creating your course…' })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/tutor/courses')
  })

  it('rejects unsupported and oversize files before making a request', () => {
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: {
        files: [new File(['image'], 'notes.png', { type: 'image/png' })]
      }
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please upload PDF, TXT, Markdown, or DOCX files.'
    )
    const largeFile = new File(['%PDF'], 'large.pdf', {
      type: 'application/pdf'
    })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [largeFile] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent('no larger than 5 MB')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([null, { ...capabilities, ready: false, missing: ['model'] }])(
    'keeps file selection enabled when service capabilities are %j',
    currentCapabilities => {
      render(
        <NewCourseForm capabilities={currentCapabilities} onCreated={vi.fn()} />
      )
      const input = screen.getByLabelText('Upload learning materials')
      const inputClick = vi.spyOn(input, 'click')
      expect(input).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Choose files' }))
      expect(inputClick).toHaveBeenCalledOnce()
      expect(
        screen.queryByText(/Tutor is not ready yet/)
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(
          'Your learning path and progress are saved automatically.'
        )
      ).not.toBeInTheDocument()
    }
  )

  it.each([
    ['notes.pdf', 'application/pdf'],
    ['notes.txt', 'text/plain'],
    ['notes.md', ''],
    ['notes.markdown', 'application/octet-stream'],
    [
      'notes.DOCX',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ])(
    'uploads a dropped %s even when teaching services are not ready',
    async (name, type) => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: { id: 'document-1', filename: name } })
      })
      render(
        <NewCourseForm
          capabilities={{ ...capabilities, ready: false, missing: ['model'] }}
          onCreated={vi.fn()}
        />
      )
      const input = screen.getByLabelText('Upload learning materials')
      const dropzone = input.parentElement!
      const file = new File(['learning material'], name, { type })
      fireEvent.dragOver(dropzone)
      expect(dropzone).toHaveClass('bg-accent')
      fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
      await screen.findByText('Uploaded')
      expect(dropzone).not.toHaveClass('bg-accent')
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/tutor/documents')
      expect(options.body.get('file')).toBe(file)
    }
  )

  it('reports missing service configuration through the normal error toast', async () => {
    state.locale = 'zh-CN'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error:
          'The AI service is not configured correctly. Please try again later.'
      })
    })
    render(<NewCourseForm capabilities={null} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('上传学习资料'), {
      target: {
        files: [new File(['text'], 'notes.txt', { type: 'text/plain' })]
      }
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        createTranslator('zh-CN')(
          'The AI service is not configured correctly. Please try again later.'
        )
      )
    )
    expect(screen.getByRole('button', { name: '重试' })).toBeEnabled()
  })

  it('enforces the total file count for subsequent drops and rejects empty files', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        document: { id: 'document-1', filename: 'notes.txt' }
      })
    })
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, maxFiles: 1 }}
        onCreated={vi.fn()}
      />
    )
    const input = screen.getByLabelText('Upload learning materials')
    fireEvent.change(input, {
      target: { files: [new File([], 'empty.txt', { type: 'text/plain' })] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent('must be non-empty')
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.change(input, {
      target: {
        files: [new File(['text'], 'notes.txt', { type: 'text/plain' })]
      }
    })
    await screen.findByText('Uploaded')
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDisabled()
    fireEvent.drop(input.parentElement!, {
      dataTransfer: { files: [new File(['more'], 'more.md')] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose up to 1 files.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('creates a course only after upload and includes goal, level, and locale', async () => {
    const onCreated = vi.fn()
    const course = { id: 'course-1' }
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'document-1', filename: 'notes.pdf' }
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ course }) })
    render(<NewCourseForm capabilities={capabilities} onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: {
        files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })]
      }
    })
    await screen.findByText('Uploaded')
    fireEvent.change(screen.getByLabelText('What are you learning for?'), {
      target: { value: 'Prepare for interviews' }
    })
    fireEvent.click(screen.getByLabelText('Some experience'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Build my learning path' })
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(course))
    const [, options] = fetchMock.mock.calls[1]
    expect(JSON.parse(options.body)).toEqual({
      documentIds: ['document-1'],
      goal: 'Prepare for interviews',
      level: 'intermediate',
      locale: 'en'
    })
    expect(options.headers.get('x-morphic-locale')).toBe('en')
  })

  it('keeps a failed upload retryable without uploading successful files again', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'document-1', filename: 'notes.pdf' }
        })
      })
    render(<NewCourseForm capabilities={capabilities} onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: {
        files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })]
      }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await screen.findByText('Uploaded')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('allows course submission with stale readiness and shows configuration errors in a toast', async () => {
    const onCreateFailed = vi.fn()
    const message =
      'The AI service is not configured correctly. Please try again later.'
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'document-1', filename: 'notes.txt' }
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: message })
      })
    render(
      <NewCourseForm
        capabilities={{ ...capabilities, ready: false, missing: ['model'] }}
        onCreated={vi.fn()}
        onCreateFailed={onCreateFailed}
      />
    )
    fireEvent.change(screen.getByLabelText('Upload learning materials'), {
      target: { files: [new File(['text'], 'notes.txt')] }
    })
    await screen.findByText('Uploaded')
    fireEvent.change(screen.getByLabelText('What are you learning for?'), {
      target: { value: 'Learn these notes' }
    })
    const submit = screen.getByRole('button', {
      name: 'Build my learning path'
    })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message))
    expect(onCreateFailed).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
