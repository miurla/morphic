'use client'
import { IconCloudUpload as UploadCloud } from '@tabler/icons-react'

import { cn } from '@/lib/utils'

import { useI18n } from '@/components/language-provider'

export function DragOverlay({ visible }: { visible: boolean }) {
  const { t } = useI18n()

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center backdrop-blur-md transition-opacity duration-200 pointer-events-none',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="text-center text-muted-foreground">
        <UploadCloud className="mx-auto mb-4 size-10" />
        <p className="text-lg font-semibold">{t('Drop files here')}</p>
      </div>
    </div>
  )
}
