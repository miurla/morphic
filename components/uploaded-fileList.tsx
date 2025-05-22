'use client'

import { UploadedFile } from '@/lib/types'
import { Loader2, X } from 'lucide-react'
import Image from 'next/image'
import React from 'react'

interface UploadedFileListProps {
  files: UploadedFile[]
  onRemove: (index: number) => void
}

export const UploadedFileList = React.memo(function UploadedFileList({
  files,
  onRemove
}: UploadedFileListProps) {
  return (
    <div className="w-full flex justify-center py-4">
      <div className="flex gap-6 overflow-x-auto">
        {files.map((it, index) => (
          <div
            key={index}
            className="relative w-28 flex-shrink-0 flex flex-col items-center"
          >
            <div className="relative w-28 h-20 rounded-lg overflow-hidden shadow border bg-muted/20 dark:bg-muted/10">
              {it.file.type.startsWith('image/') ? (
                <Image
                  src={URL.createObjectURL(it.file)}
                  alt={`file-${index}`}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold bg-gray-300 dark:bg-gray-700">
                  {it.file.name.split('.').pop()?.toUpperCase()}
                </div>
              )}

              {/* Spinner overlay while uploading */}
              {it.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  <Loader2 className="animate-spin text-white" size={20} />
                </div>
              )}

              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 bg-black/40 hover:bg-red-600 text-white rounded-full p-1 z-20"
              >
                <X size={12} />
              </button>
            </div>

            <div className="mt-2 text-xs text-center text-foreground truncate w-full">
              {it.name || it.file.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
