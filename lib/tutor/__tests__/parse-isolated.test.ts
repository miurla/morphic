// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseDocumentIsolated } from '../parse-isolated'

let directory: string
const scriptPath = path.join(
  process.cwd(),
  'lib/tutor/__tests__/__fixtures__/parse-worker.cjs'
)
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'tutor-isolation-'))
})
afterEach(async () => {
  await rm(directory, { force: true, recursive: true })
})

async function waitForExit(pid: number) {
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('Parser child was not terminated')
}

describe('isolated document parsing', () => {
  it('returns results and closes its child process', async () => {
    const marker = path.join(directory, 'pid')
    const result = await parseDocumentIsolated(marker, 'success', {
      scriptPath,
      timeoutMs: 5000
    })
    expect(result.parsed.pageCount).toBe(1)
    await waitForExit(Number(await readFile(marker, 'utf8')))
  })

  it('actually terminates a synchronous infinite parser on timeout', async () => {
    const marker = path.join(directory, 'pid')
    await expect(
      parseDocumentIsolated(marker, 'hang', { scriptPath, timeoutMs: 2000 })
    ).rejects.toMatchObject({ code: 'PARSE_TIMEOUT' })
    await waitForExit(Number(await readFile(marker, 'utf8')))
  }, 8000)

  it('does not launch work after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      parseDocumentIsolated('u', 'd', { scriptPath, signal: controller.signal })
    ).rejects.toMatchObject({ code: 'PARSE_CANCELLED' })
  })
})
