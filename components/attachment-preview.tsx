'use client'

import React from 'react'

interface Attachment {
  name: string | undefined
  url?: string
  contentType: string
}

interface AttachmentPreviewProps {
  attachments: Attachment[]
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments
}) => {
  if (!attachments?.length) return null

  return (
    <div className="flex flex-wrap gap-4">
      {attachments.map((att, index) => {
        const isImage = att.contentType.startsWith('image/')
        const isPdf = att.contentType === 'application/pdf'
        const url = att.url

        return (
          <div key={index} className="max-w-xs break-words">
            {!url ? (
              <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                {att.name ?? 'File'} unavailable
              </div>
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={att.name}
                className="rounded-md border max-h-16 object-contain"
              />
            ) : isPdf ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                📄 {att.name}
              </a>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                📎 {att.name}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
