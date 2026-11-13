const KANA = /[぀-ヿ]/g
const LATIN_WORD = /[A-Za-z]{2,}/g

function stripNonProse(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ')
}

/**
 * Kana only appear in Japanese prose, so their count separates a Japanese
 * answer from an English one that quotes a Japanese name.
 */
export function classifyLanguage(text: string): 'ja' | 'en' | 'mixed' {
  const prose = stripNonProse(text)
  const kana = prose.match(KANA)?.length ?? 0
  const latinWords = prose.match(LATIN_WORD)?.length ?? 0

  if (kana >= 20 && kana > latinWords) return 'ja'
  if (kana <= 5 && latinWords >= 20) return 'en'
  return 'mixed'
}
