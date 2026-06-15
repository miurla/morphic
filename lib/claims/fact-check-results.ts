import type { FactCheckSearchResults } from '@/lib/tools/factcheck'

type ToolPartLike = {
  type?: string
  toolName?: string
  state?: string
  output?: any
}

function isCompleteFactCheckOutput(
  output: any
): output is FactCheckSearchResults {
  return (
    output?.state === 'complete' &&
    typeof output.query === 'string' &&
    Array.isArray(output.claims)
  )
}

function isFactCheckToolPart(part: ToolPartLike) {
  return (
    part.type === 'tool-googleFactCheck' ||
    (part.type === 'dynamic-tool' && part.toolName === 'googleFactCheck')
  )
}

export function collectFactCheckResultsFromMessageParts(
  parts: ToolPartLike[] = []
): FactCheckSearchResults[] {
  const results: FactCheckSearchResults[] = []

  for (const part of parts) {
    if (
      !isFactCheckToolPart(part) ||
      part.state !== 'output-available' ||
      !isCompleteFactCheckOutput(part.output)
    ) {
      continue
    }

    results.push({
      query: part.output.query,
      claims: part.output.claims
    })
  }

  return results
}
