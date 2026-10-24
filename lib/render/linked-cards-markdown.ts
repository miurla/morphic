import { parseSpecBlock } from './parse-spec-block'

const FENCE_BODY = /^```spec\s*\n([\s\S]*?)```$/

type Element = {
  type: string
  props?: Record<string, unknown>
  children?: string[]
}

/**
 * Turns a ```spec fence holding linked Cards into a markdown list, or returns
 * null when the fence holds none. Linked cards stand in for the list the answer
 * would otherwise contain, so dropping them from history or a copied answer
 * would lose the items themselves. Must depend only on the fence text: the
 * history path runs on the prompt-cache prefix.
 */
export function linkedCardsFenceToMarkdown(fence: string): string | null {
  if (!fence.includes('"Card"')) return null

  const body = FENCE_BODY.exec(fence.trim())?.[1]
  if (!body) return null

  let elements: Record<string, Element>
  try {
    elements = parseSpecBlock(body).elements as Record<string, Element>
  } catch {
    return null
  }

  const lines: string[] = []
  for (const element of Object.values(elements)) {
    const href = element.props?.href
    if (element.type !== 'Card' || typeof href !== 'string') continue

    const children = (element.children ?? [])
      .map(key => elements[key])
      .filter(Boolean)
    const texts = children
      .filter(child => child.type === 'Text')
      .map(child => String(child.props?.text ?? ''))
      .filter(Boolean)
    const badges = children
      .filter(child => child.type === 'Badge')
      .map(child => `(${String(child.props?.text ?? '')})`)

    const [title = href, ...rest] = texts
    const detail = [...rest, ...badges].join(' ')
    lines.push(`- [${title}](${href})${detail ? `: ${detail}` : ''}`)
  }

  return lines.length > 0 ? lines.join('\n') : null
}
