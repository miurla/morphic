'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { useRouter } from 'next/navigation'

import { UseChatHelpers } from '@ai-sdk/react'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { toast } from 'sonner'

import { UploadedFile } from '@/lib/types'
import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'

import { useArtifact } from './artifact/artifact-context'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { EmptyScreen } from './empty-screen'
import { FileUploadButton } from './file-upload-button'
import { ModelSelector } from './model-selector'
import { UploadedFileList } from './uploaded-file-list'

interface ChatPanelProps {
  chatId: string
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  status: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  messages: UIMessage[]
  setMessages: (messages: UIMessage[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: Model[]
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
}

export function ChatPanel({
  chatId,
  input,
  handleInputChange,
  handleSubmit,
  status,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  showScrollToBottomButton,
  uploadedFiles,
  setUploadedFiles,
  scrollContainerRef
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { close: closeArtifact } = useArtifact()
  const isLoading = status === 'submitted' || status === 'streaming'

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      (lastPart?.type === 'tool-search' ||
        lastPart?.type === 'tool-fetch' ||
        lastPart?.type === 'tool-askQuestion') &&
      ((lastPart as any)?.state === 'input-streaming' ||
        (lastPart as any)?.state === 'input-available')
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleFileRemove = useCallback(
    (index: number) => {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    },
    [setUploadedFiles]
  )
  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-4' : 'px-6'
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center gap-4">
          <IconLogo className="size-12 text-muted-foreground" />
          <p className="text-center text-3xl font-semibold">
            How can I help you today?
          </p>
        </div>
      )}
      {uploadedFiles.length > 0 && (
        <UploadedFileList files={uploadedFiles} onRemove={handleFileRemove} />
      )}
      <form
        onSubmit={handleSubmit}
        className={cn('max-w-3xl w-full mx-auto relative')}
      >
        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask a question..."
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <ModelSelector models={models || []} />
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 rounded-full group"
                  type="button"
                  disabled={isLoading || isToolInvocationInProgress()}
                >
                  <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                </Button>
              )}
              <FileUploadButton
                onFileSelect={async files => {
                  const newFiles: UploadedFile[] = files.map(file => ({
                    file,
                    status: 'uploading'
                  }))
                  setUploadedFiles(prev => [...prev, ...newFiles])
                  await Promise.all(
                    newFiles.map(async uf => {
                      const formData = new FormData()
                      formData.append('file', uf.file)
                      formData.append('chatId', chatId)
                      try {
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          body: formData
                        })

                        if (!res.ok) {
                          throw new Error('Upload failed')
                        }

                        const { file: uploaded } = await res.json()
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file
                              ? {
                                  ...f,
                                  status: 'uploaded',
                                  url: uploaded.url,
                                  name: uploaded.filename,
                                  key: uploaded.key
                                }
                              : f
                          )
                        )
                      } catch (e) {
                        toast.error(`Failed to upload ${uf.file.name}`)
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file ? { ...f, status: 'error' } : f
                          )
                        )
                      }
                    })
                  )
                }}
              />
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(isLoading && 'animate-pulse', 'rounded-full')}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress()
                }
                onClick={isLoading ? stop : undefined}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <EmptyScreen
            submitMessage={message => {
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }}
            className={cn(showEmptyScreen ? 'visible' : 'invisible')}
          />
        )}
      </form>
    </div>
  )
}
