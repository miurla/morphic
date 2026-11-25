/** Shared by the file picker and the server; no server-only imports. */
export type TutorDocumentFormat = 'pdf' | 'txt' | 'md' | 'docx'

export const TUTOR_DOCUMENT_ACCEPT =
  '.pdf,.txt,.md,.markdown,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function getTutorDocumentFormat(
  filename: string
): TutorDocumentFormat | null {
  if (filename.lastIndexOf('.') <= 0) return null
  const extension = filename.toLowerCase().split('.').pop()
  if (extension === 'markdown') return 'md'
  return extension === 'pdf' ||
    extension === 'txt' ||
    extension === 'md' ||
    extension === 'docx'
    ? extension
    : null
}

export function getTutorDocumentMimeType(filename: string): string {
  switch (getTutorDocumentFormat(filename)) {
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    case 'md':
      return 'text/markdown'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}
