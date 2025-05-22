'use client'

import React from 'react'

interface Attachment {
  name: string | undefined
  url: string
  contentType: string
}
;[]
interface AttachmentPreviewProps {
  attachments: Attachment[]
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments
}) => {
  if (!attachments?.length) return null

  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {attachments.map((att, index) => {
        const isImage = att.contentType.startsWith('image/')
        const isPdf = att.contentType === 'application/pdf'

        return (
          <div key={index} className="max-w-xs break-words">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.url}
                alt={att.name}
                className="rounded border max-h-60 object-contain"
              />
            ) : isPdf ? (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                📄 {att.name}
              </a>
            ) : (
              <a
                href={att.url}
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
