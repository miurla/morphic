import { linkedCardsFenceToMarkdown } from './linked-cards-markdown'

/**
 * Remove ```spec fenced blocks from text content, keeping linked Card items as
 * a markdown list.
 * Used when copying message text to clipboard.
 */
export function stripSpecBlocks(text: string): string {
  return text
    .replace(/```spec[\s\S]*?```/g, block => {
      return linkedCardsFenceToMarkdown(block) ?? ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
