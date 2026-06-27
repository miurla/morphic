'use client'

import React from 'react'

import { IconLoader2 as Loader2, IconX as X } from '@tabler/icons-react'

import { UploadedFile } from '@/lib/types'

interface UploadedFileListProps {
  files: UploadedFile[]
  onRemove: (index: number) => void
}

export const UploadedFileList = React.memo(function UploadedFileList({
  files,
  onRemove
}: UploadedFileListProps) {
  return (
    <div className="w-full flex p-4 max-w-3xl mx-auto">
      <div className="flex gap-6 overflow-x-auto">
        {files.map((it, index) => {
          return (
            <UploadedFileListItem
              key={index}
              file={it}
              index={index}
              onRemove={onRemove}
            />
          )
        })}
      </div>
    </div>
  )
})

const UploadedFileListItem = React.memo(function UploadedFileListItem({
  file,
  index,
  onRemove
}: {
  file: UploadedFile
  index: number
  onRemove: (index: number) => void
}) {
  const [objectUrl, setObjectUrl] = React.useState<
    { file: File; url: string } | undefined
  >()
  const mediaType = file.mediaType ?? file.file?.type ?? ''
  const filename = file.name ?? file.file?.name ?? 'file'
  const isImage = mediaType.startsWith('image/')
  const imageSrc =
    file.url && file.status === 'uploaded'
      ? file.url
      : objectUrl && objectUrl.file === file.file
        ? objectUrl.url
        : undefined

  React.useEffect(() => {
    if ((file.url && file.status === 'uploaded') || !file.file) {
      setObjectUrl(undefined)
      return
    }

    const nextObjectUrl = URL.createObjectURL(file.file)
    setObjectUrl({ file: file.file, url: nextObjectUrl })

    return () => URL.revokeObjectURL(nextObjectUrl)
  }, [file.file, file.status, file.url])

  return (
    <div className="relative w-20 shrink-0 flex flex-col items-center">
      <div className="relative w-20 aspect-7/5 rounded-lg overflow-hidden shadow-sm border bg-muted/20 dark:bg-muted/10">
        {isImage && imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={`file-${index}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-semibold bg-gray-300 dark:bg-gray-700">
            {filename.split('.').pop()?.toUpperCase()}
          </div>
        )}

        {/* Spinner overlay while uploading */}
        {file.status === 'uploading' && (
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
        {filename}
      </div>
    </div>
  )
})
