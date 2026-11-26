import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadTutorFile } from '../api'

class FakeXhr {
  static instances: FakeXhr[] = []
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  responseText = ''
  status = 200
  timeout = 0
  open = vi.fn()
  setRequestHeader = vi.fn()
  send = vi.fn()
  abort = vi.fn(() => this.onabort?.())
  constructor() {
    FakeXhr.instances.push(this)
  }
}

beforeEach(() => {
  FakeXhr.instances = []
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})
afterEach(() => vi.unstubAllGlobals())

describe('Tutor binary upload', () => {
  it('sends the original file with an encoded filename, locale and actual byte progress', async () => {
    const file = new File(['notes'], '笔记 1.txt')
    const progress = vi.fn()
    const promise = uploadTutorFile(
      file,
      'zh-CN',
      new AbortController().signal,
      progress
    )
    const xhr = FakeXhr.instances[0]
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/tutor/documents')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/octet-stream'
    )
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'x-tutor-filename',
      encodeURIComponent(file.name)
    )
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'x-morphic-locale',
      'zh-CN'
    )
    expect(xhr.send).toHaveBeenCalledWith(file)
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 3,
      total: 5
    } as ProgressEvent)
    expect(progress).toHaveBeenCalledWith(60)
    xhr.responseText = JSON.stringify({ document: { id: 'a' } })
    xhr.onload?.()
    await expect(promise).resolves.toEqual({ document: { id: 'a' } })
  })

  it('aborts the underlying request and ignores its late success callback', async () => {
    const controller = new AbortController()
    const promise = uploadTutorFile(
      new File(['x'], 'a.txt'),
      'en',
      controller.signal,
      vi.fn()
    )
    const result = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    const xhr = FakeXhr.instances[0]
    expect(xhr.abort).toHaveBeenCalledOnce()
    xhr.responseText = JSON.stringify({ document: { id: 'late' } })
    xhr.onload?.()
    await result
  })

  it('does not send an already cancelled upload', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      uploadTutorFile(
        new File(['x'], 'a.txt'),
        'en',
        controller.signal,
        vi.fn()
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeXhr.instances[0].send).not.toHaveBeenCalled()
  })

  it.each(['network', 'timeout', 'bad-json', 'http'] as const)(
    'rejects %s failures',
    async kind => {
      const promise = uploadTutorFile(
        new File(['x'], 'a.txt'),
        'en',
        new AbortController().signal,
        vi.fn()
      )
      const result = expect(promise).rejects.toBeInstanceOf(Error)
      const xhr = FakeXhr.instances[0]
      if (kind === 'network') xhr.onerror?.()
      else if (kind === 'timeout') xhr.ontimeout?.()
      else {
        xhr.status = kind === 'http' ? 413 : 200
        xhr.responseText =
          kind === 'http'
            ? JSON.stringify({ error: 'Too large', code: 'REQUEST_TOO_LARGE' })
            : '<html>error</html>'
        xhr.onload?.()
      }
      await result
    }
  )
})
