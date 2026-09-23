/**
 * Remove application source-context blocks from assistant text.
 */
export function stripSourceContextBlocks(text: string): string {
  if (!text.includes('<source_context>')) return text

  return text
    .replace(/<source_context>[\s\S]*?<\/source_context>/g, '')
    .replace(/<source_context>[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}
