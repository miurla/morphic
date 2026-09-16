type ResponseWithParts = {
  parts?: Array<{ type?: string }>
}

/**
 * AI SDK emits a step-start marker before any observable model output. Treat
 * that marker alone as a zero-content response, while counting every other
 * part (text, reasoning, source, or tool) as delivered work.
 */
export function hasResponseContentPart(
  response: ResponseWithParts | null | undefined
): boolean {
  return response?.parts?.some(part => part.type !== 'step-start') ?? false
}
