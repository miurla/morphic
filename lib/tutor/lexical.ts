const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

/** Identical normalization is used for documents and queries. */
export function lexicalTerms(text: string): string[] {
  const normalized = text.normalize('NFKC').toLowerCase()
  const words = Array.from(segmenter.segment(normalized))
    .filter(segment => segment.isWordLike)
    .map(segment => segment.segment)
  // Keep identifiers in addition to natural-language word boundaries.
  const identifiers = normalized.match(/[a-z_][a-z\d_+#.-]*/g) ?? []
  // ICU versions differ on compounds such as 数据库 (数据 + 库). Preserve short
  // adjacent compounds in both paths instead of relying on one segmentation.
  const compounds: string[] = []
  for (const run of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    const segments = Array.from(segmenter.segment(run)).map(
      item => item.segment
    )
    for (let index = 0; index < segments.length; index++) {
      for (let size = 2; size <= 3 && index + size <= segments.length; size++) {
        const compound = segments.slice(index, index + size).join('')
        if (compound.length <= 8) compounds.push(compound)
      }
    }
  }
  return [...new Set([...words, ...identifiers, ...compounds])]
    .filter(word => /[\p{L}\p{N}]/u.test(word))
    .slice(0, 4096)
}

export function buildLexicalText(text: string): string {
  return lexicalTerms(text).join(' ')
}

export function buildLexicalQuery(text: string): string {
  return lexicalTerms(text).slice(0, 64).join(' ')
}
