import type { Spec } from '@json-render/core'

import { type ReviseIntent, revisionIntentFromQuery } from '@/lib/draft/revise'

export type RevisionSuggestion = {
  suggestionId: string
  position: number
  intent: ReviseIntent
  query: string
}

/** Use local positional ids, never model-provided ids or content, in analytics. */
export function prepareRevisionSuggestions(spec: Spec): {
  spec: Spec
  suggestions: RevisionSuggestion[]
} {
  if (!spec.root || !spec.elements) return { spec, suggestions: [] }
  const visible: string[] = []
  const seen = new Set<string>()
  function visit(id: string) {
    if (seen.has(id) || !spec.elements[id]) return
    seen.add(id)
    visible.push(id)
    for (const child of spec.elements[id].children ?? []) visit(child)
  }
  visit(spec.root)
  const elements = { ...spec.elements }
  const suggestions: RevisionSuggestion[] = []
  for (const id of visible) {
    const element = elements[id]
    if (element.type !== 'Button') continue
    const press = element.on?.press
    if (!press || Array.isArray(press)) continue
    const { action, params } = press
    if (action !== 'submitQuery') continue
    if (typeof params?.query !== 'string' || !params.query.trim()) continue
    const intent = revisionIntentFromQuery(params.query)
    if (!intent) continue
    const position = suggestions.length
    suggestions.push({
      suggestionId: `revise-${position + 1}`,
      position,
      intent,
      query: params.query
    })
    elements[id] = {
      ...element,
      on: {
        ...element.on,
        press: {
          action: 'submitQuery',
          params: { query: params.query, position }
        }
      }
    }
  }
  return { spec: { ...spec, elements }, suggestions }
}
