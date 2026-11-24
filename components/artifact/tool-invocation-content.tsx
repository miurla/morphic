'use client'

import type { ToolPart } from '@/lib/types/ai'

import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
import { useI18n } from '@/components/language-provider'

export function ToolInvocationContent({ part }: { part: ToolPart }) {
  const { t } = useI18n()

  switch (part.type) {
    case 'tool-search':
      return <SearchArtifactContent tool={part as ToolPart<'search'>} />
    default:
      return (
        <div className="p-4">
          {t('Details for this tool are not available')}
        </div>
      )
  }
}
