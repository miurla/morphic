import { createPartialSpecParser } from './parse-spec-block'

const FENCE_BODY = /^```spec\s*\n([\s\S]*?)```$/

export type SpecElement = {
  type: string
  props?: Record<string, unknown>
  children?: string[]
}

/**
 * Elements reachable from the root, in the order they render. Elements the
 * root does not reach are never shown, so they are left out.
 */
export function reachableElements(
  root: string,
  elements: Record<string, SpecElement>
): SpecElement[] {
  const ordered: SpecElement[] = []
  const seen = new Set<string>()
  const walk = (key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    const element = elements[key]
    if (!element) return
    ordered.push(element)
    for (const child of element.children ?? []) walk(child)
  }
  walk(root)
  return ordered
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

  // The same lenient parser the renderer uses, so a block that renders some
  // cards despite a malformed line keeps those cards here too.
  const spec = createPartialSpecParser().parse(body)
  if (!spec) return null
  const elements = spec.elements as Record<string, SpecElement>

  const lines: string[] = []
  // Rendered order, so a follow-up like "the second one" points at the same
  // item the user sees.
  for (const element of reachableElements(spec.root, elements)) {
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
