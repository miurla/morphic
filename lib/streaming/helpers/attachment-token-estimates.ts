import type { UIMessage } from 'ai'

import { estimateAttachmentTokens } from '@/lib/utils/attachment-tokens'

import { isFilePart } from './attachment-parts'

/**
 * Builds the token estimates before model-message conversion removes custom
 * attachment metadata such as the resolved storage size. The URL is the stable
 * value shared by both representations and is not sent to providers as extra
 * metadata.
 */
export function buildAttachmentTokenEstimates(
  messages: UIMessage[]
): ReadonlyMap<string, number> {
  const estimates = new Map<string, number>()

  for (const message of messages) {
    for (const part of message.parts) {
      if (!isFilePart(part)) continue

      const file = part as { mediaType?: string; size?: number; url?: string }
      if (!file.url) continue

      estimates.set(file.url, estimateAttachmentTokens(file))
    }
  }

  return estimates
}
