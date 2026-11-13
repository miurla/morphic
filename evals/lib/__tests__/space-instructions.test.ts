import { describe, expect, it } from 'vitest'

import {
  classifyLanguage,
  classifyShortLanguage,
  followsStructure,
  hasChineseClause,
  splitDraft
} from '../space-instructions'

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

describe('splitDraft', () => {
  it('separates the draft block from the reply around it', () => {
    const text =
      '英語で記事をまとめました。\n\n````draft\ntitle: EV batteries\n\n# EV batteries\nBody.\n````\n\n```spec\n{}\n```'
    expect(splitDraft(text)).toEqual({
      draft: 'title: EV batteries\n\n# EV batteries\nBody.\n',
      outside: '英語で記事をまとめました。'
    })
  })

  it('returns the whole reply when there is no draft', () => {
    expect(splitDraft('Just an answer.')).toEqual({
      draft: null,
      outside: 'Just an answer.'
    })
  })
})

describe('classifyShortLanguage', () => {
  it('reads one Japanese sentence as Japanese', () => {
    expect(classifyShortLanguage('記事を英語でまとめました。[1](#S1)')).toBe(
      'ja'
    )
  })

  it('reads one English sentence as English', () => {
    expect(classifyShortLanguage('I wrote the article in English.')).toBe('en')
  })

  it('reports an empty reply', () => {
    expect(classifyShortLanguage('  ')).toBe('empty')
  })
})

describe('hasChineseClause', () => {
  it('flags a Chinese clause inside a Japanese reply', () => {
    expect(
      hasChineseClause(
        '本文用英語撰寫，並以味わい・手間・必要な器具の観点から比較します。'
      )
    ).toBe(true)
  })

  it('does not flag Japanese with kanji-only names', () => {
    expect(
      hasChineseClause(
        '主要ルートは吉田・須走・御殿場・富士宮の4つです。国立研究開発法人の資料も参照しました。'
      )
    ).toBe(false)
  })
})
