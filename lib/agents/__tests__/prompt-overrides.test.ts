import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyPromptOverrideSync,
  loadPromptOverrideSync
} from '../prompt-overrides'

const originalDir = process.env.MORPHIC_PROMPT_OVERRIDES_DIR
const originalMode = process.env.MORPHIC_PROMPT_OVERRIDE_MODE

function withTempPromptDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'morphic-prompts-'))
  process.env.MORPHIC_PROMPT_OVERRIDES_DIR = dir
  return dir
}

afterEach(() => {
  process.env.MORPHIC_PROMPT_OVERRIDES_DIR = originalDir
  process.env.MORPHIC_PROMPT_OVERRIDE_MODE = originalMode
})

describe('prompt overrides', () => {
  it('returns null when an allowlisted override is missing', () => {
    const dir = withTempPromptDir()

    try {
      expect(loadPromptOverrideSync('quick')).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loads an allowlisted local override', () => {
    const dir = withTempPromptDir()
    writeFileSync(path.join(dir, 'adaptive.md'), '  Use stricter review.  ')

    try {
      expect(loadPromptOverrideSync('adaptive')).toBe('Use stricter review.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('appends local overrides by default with a safety boundary', () => {
    const dir = withTempPromptDir()
    writeFileSync(path.join(dir, 'router.md'), 'Consult specialist models.')

    try {
      const prompt = applyPromptOverrideSync('Base router prompt.', 'router')
      expect(prompt).toContain('Base router prompt.')
      expect(prompt).toContain('Private local prompt override')
      expect(prompt).toContain('Consult specialist models.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('supports explicit replace mode for local-only deployments', () => {
    const dir = withTempPromptDir()
    process.env.MORPHIC_PROMPT_OVERRIDE_MODE = 'replace'
    writeFileSync(path.join(dir, 'quick.md'), 'Local quick prompt.')

    try {
      expect(applyPromptOverrideSync('Base quick prompt.', 'quick')).toBe(
        'Local quick prompt.'
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores oversized prompt overrides', () => {
    const dir = withTempPromptDir()
    writeFileSync(path.join(dir, 'quick.md'), 'x'.repeat(20_001))

    try {
      expect(loadPromptOverrideSync('quick')).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
