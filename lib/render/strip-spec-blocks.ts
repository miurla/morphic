/**
 * Remove ```spec fenced blocks from text content.
 * Used when copying message text to clipboard.
 */
export function stripSpecBlocks(text: string): string {
  return text
    .replace(/```spec[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
