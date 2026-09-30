export const MAX_ATTACHMENTS_PER_MESSAGE = 3

export function countFileParts(message: unknown): number {
  if (typeof message !== 'object' || message === null) return 0

  const parts = (message as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return 0

  return parts.filter(
    part =>
      typeof part === 'object' &&
      part !== null &&
      (part as { type?: unknown }).type === 'file'
  ).length
}

export function remainingAttachmentSlots(currentCount: number): number {
  return Math.max(0, MAX_ATTACHMENTS_PER_MESSAGE - currentCount)
}
