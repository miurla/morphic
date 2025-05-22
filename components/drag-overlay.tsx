'use client'
import { cn } from '@/lib/utils'
import { UploadCloud } from 'lucide-react'

export function DragOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center backdrop-blur-md transition-opacity duration-200 pointer-events-none',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="text-center text-muted-foreground">
        <UploadCloud className="mx-auto mb-4 w-10 h-10" />
        <p className="text-lg font-semibold">Drop files here</p>
      </div>
    </div>
  )
}
