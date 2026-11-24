'use client'

import React from 'react'

import { useI18n } from '@/components/language-provider'

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
  const { t } = useI18n()

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
                {t('{name} unavailable', { name: att.name ?? t('File') })}
              </div>
            ) : isImage ? (
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={att.name ?? t('Attachment')}
                  className="size-full object-contain"
                />
              </div>
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
