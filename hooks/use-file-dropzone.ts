import { UploadedFile } from '@/lib/types'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

type UseFileDropzoneProps = {
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  maxFiles?: number
  allowedTypes?: string[]
  chatId: string
}

export function useFileDropzone({
  uploadedFiles,
  setUploadedFiles,
  chatId,
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
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const rawFiles = Array.from(e.dataTransfer.files)

      const allowed = rawFiles.filter(file => allowedTypes.includes(file.type))
      const rejected = rawFiles.filter(file => !allowed.includes(file))

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

      const initialFiles: UploadedFile[] = allowed.map(file => ({
        file,
        status: 'uploading'
      }))

      setUploadedFiles(prev => [...prev, ...initialFiles].slice(0, maxFiles))

      await Promise.all(
        initialFiles.map(async uf => {
          const formData = new FormData()
          formData.append('file', uf.file)
          formData.append('chatId', chatId)

          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            })

            if (!res.ok) throw new Error('Upload failed')

            const { file: uploaded } = await res.json()

            setUploadedFiles(prev =>
              prev.map(f =>
                f.file === uf.file
                  ? {
                      ...f,
                      status: 'uploaded',
                      url: uploaded.url,
                      name: uploaded.name,
                      key: uploaded.key
                    }
                  : f
              )
            )
          } catch (err) {
            toast.error(`Failed to upload ${uf.file.name}`)
            setUploadedFiles(prev =>
              prev.map(f =>
                f.file === uf.file ? { ...f, status: 'error' } : f
              )
            )
          }
        })
      )
    },
    [allowedTypes, maxFiles, uploadedFiles, setUploadedFiles, chatId]
  )

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
