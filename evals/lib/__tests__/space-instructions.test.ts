import { describe, expect, it } from 'vitest'

import { classifyLanguage, followsStructure } from '../space-instructions'

describe('classifyLanguage', () => {
  it('reads a Japanese answer with English terms as Japanese', () => {
    const text =
      '富士山の吉田ルートは初心者に向いています。山小屋が多く、PostgreSQL や LFP のような英語の用語が少し入っても日本語の回答です。[1](#S1)'
    expect(classifyLanguage(text)).toBe('ja')
  })

  it('reads an English answer quoting a Japanese name as English', () => {
    const text =
      'The Yoshida Trail (吉田ルート) is the most popular route for first-time climbers because it has the most mountain huts and the clearest signage, and it is the easiest to reach from Tokyo by bus. [1](#S1)'
    expect(classifyLanguage(text)).toBe('en')
  })

  it('ignores links and markup', () => {
    const text = `${'Short answer in English with enough words here. '.repeat(3)}<spec>ないよう</spec> [1](https://example.com/日本語のページ)`
    expect(classifyLanguage(text)).toBe('en')
  })
})

describe('followsStructure', () => {
  const summary = '- one\n- two\n- three'

  it('accepts H2 headings ending in three bullets, ignoring the spec block', () => {
    const text = `## Overview\n\nBody text.\n\n## Summary\n${summary}\n\n\`\`\`spec\n{"op":"add"}\n\`\`\``
    expect(followsStructure(text)).toBe(true)
  })

  it('rejects an answer without H2 headings', () => {
    expect(followsStructure(`Body text.\n\n${summary}`)).toBe(false)
  })

  it('rejects a summary with another bullet count', () => {
    expect(followsStructure(`## Summary\n${summary}\n- four`)).toBe(false)
    expect(followsStructure('## Summary\n- one\n- two')).toBe(false)
  })

  it('rejects text after the bullets', () => {
    expect(followsStructure(`## Summary\n${summary}\n\nHope this helps.`)).toBe(
      false
    )
  })
})
