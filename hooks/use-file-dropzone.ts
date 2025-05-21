import { useCallback, useState } from 'react'
import { toast } from 'sonner'
type UseFileDropzoneProps = {
  uploadedFiles: File[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>
  maxFiles?: number
  allowedTypes?: string[]
}

export function useFileDropzone({
  uploadedFiles,
  setUploadedFiles,
  maxFiles = 3,
  allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
}: UseFileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).slice(0, maxFiles)

      const allowed = files.filter(file => allowedTypes.includes(file.type))
      const rejected = files.filter(file => !allowed.includes(file))

      if (rejected.length > 0) {
        toast.error(
          'Some files were not accepted: ' +
            rejected.map(f => f.name).join(', ')
        )
      }

      const total = uploadedFiles.length + allowed.length
      if (total > maxFiles) {
        toast.error(`You can upload a maximum of ${maxFiles} files.`)
        return
      }

      if (allowed.length > 0) {
        setUploadedFiles(prev => [...prev, ...allowed].slice(0, maxFiles))
      }
    },
    [allowedTypes, maxFiles, uploadedFiles, setUploadedFiles]
  )

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
