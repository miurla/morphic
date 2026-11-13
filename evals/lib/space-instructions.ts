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

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+\S/

/**
 * At least one H2 heading, and the answer ends with exactly three bullets.
 */
export function followsStructure(text: string): boolean {
  const lines = text
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
  if (!lines.some(line => /^##\s+\S/.test(line))) return false

  let bullets = 0
  for (let i = lines.length - 1; i >= 0 && BULLET.test(lines[i]); i--) {
    bullets++
  }
  return bullets === 3
}
