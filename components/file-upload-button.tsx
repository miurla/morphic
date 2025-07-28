'use client'

import { useRef, useState } from 'react'

import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const allowedOtherTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

const isAllowedFileType = (file: File) =>
  allowedImageTypes.includes(file.type) || allowedOtherTypes.includes(file.type)

export function FileUploadButton({
  onFileSelect
}: {
  onFileSelect: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files).slice(0, 3)

    const validFiles = fileArray.filter(isAllowedFileType)
    const rejected = fileArray.filter(f => !isAllowedFileType(f))

    if (rejected.length > 0) {
      toast.error(
        'Some files were not accepted: ' + rejected.map(f => f.name).join(', ')
      )
    }

    if (validFiles.length > 0) {
      onFileSelect(validFiles)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-full',
        isDragging && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      title="Drag and drop or click to upload"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        hidden
        multiple
        onChange={e => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={18} />
      </Button>
    </div>
  )
}
