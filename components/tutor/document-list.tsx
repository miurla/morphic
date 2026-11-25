import { IconFileText } from '@tabler/icons-react'

import { getTutorDocumentFormat } from '@/lib/tutor/document-formats'
import type { TutorDocument } from '@/lib/tutor/types'

import { useI18n } from '@/components/language-provider'

export function TutorDocumentList({
  documents
}: {
  documents: TutorDocument[]
}) {
  const { t } = useI18n()
  return (
    <div className="mt-5">
      <ul className="space-y-3" aria-label={t('Learning materials')}>
        {documents.map(document => (
          <li
            key={document.id}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <IconFileText className="size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <span className="break-all">{document.filename}</span>
              {getTutorDocumentFormat(document.filename) === 'pdf' &&
                document.pageCount !== null && (
                  <span className="ml-2 whitespace-nowrap">
                    {t('{count} pages', { count: document.pageCount })}
                  </span>
                )}
              {document.error && (
                <p className="mt-1 text-destructive">{t(document.error)}</p>
              )}
              {document.warnings?.map((warning, index) => {
                const pages = warning.match(
                  /^Pages with little or no extracted text: (.+)$/
                )?.[1]
                return (
                  <p
                    key={index}
                    className="mt-2 rounded-md border bg-muted/30 px-2 py-1.5 leading-relaxed"
                  >
                    {pages
                      ? t('Pages with little or no extracted text: {pages}', {
                          pages
                        })
                      : t(warning)}
                  </p>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
      {documents.some(document => document.warnings?.length) && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t(
            'These may be covers, illustrations, or scanned pages. If they contain learning content, add a version with selectable text.'
          )}
        </p>
      )}
    </div>
  )
}
