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

const DRAFT_BLOCK = /````draft\n([\s\S]*?)````/

/**
 * Separates a draft block from the reply around it.
 */
export function splitDraft(text: string): {
  draft: string | null
  outside: string
} {
  const match = text.match(DRAFT_BLOCK)
  const outside = (match ? text.replace(match[0], ' ') : text)
    .replace(/```[\s\S]*?```/g, ' ')
    .trim()
  return { draft: match ? match[1] : null, outside }
}

/**
 * For the one or two sentences around a draft, where the thresholds of
 * `classifyLanguage` are too high.
 */
export function classifyShortLanguage(
  text: string
): 'ja' | 'en' | 'mixed' | 'empty' {
  const prose = stripNonProse(text)
  if (!prose.trim()) return 'empty'
  const kana = prose.match(KANA)?.length ?? 0
  const latinWords = prose.match(LATIN_WORD)?.length ?? 0

  if (kana >= 3 && kana > latinWords) return 'ja'
  if (kana <= 2 && latinWords >= 3) return 'en'
  return 'mixed'
}

const CLAUSE_BREAK = /[。，、,.!?！？\n]/
const HAN = /[一-鿿]/g
const CHINESE_ONLY = /[的了们們这這个個吗嗎呢说說与與并並将將于於写寫撰]/

/**
 * A clause with no kana, several hanzi, and a character that Japanese prose
 * does not use there reads as Chinese mixed into a Japanese reply.
 */
export function hasChineseClause(text: string): boolean {
  return stripNonProse(text)
    .split(CLAUSE_BREAK)
    .some(
      clause =>
        !/[぀-ヿ]/.test(clause) &&
        (clause.match(HAN)?.length ?? 0) >= 4 &&
        CHINESE_ONLY.test(clause)
    )
}
