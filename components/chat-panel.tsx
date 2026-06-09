'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import Textarea from 'react-textarea-autosize'
import { useRouter } from 'next/navigation'

import { UseChatHelpers } from '@ai-sdk/react'
import {
  IconArrowsDiagonal as ArrowsDiagonal,
  IconArrowUp as ArrowUp,
  IconChevronDown as ChevronDown,
  IconFileText as FileText,
  IconMessageCirclePlus as MessageCirclePlus,
  IconSquare as Square,
  IconX as X
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { captureClient } from '@/lib/analytics/posthog-client'
import { SHORTCUT_EVENTS } from '@/lib/keyboard-shortcuts'
import {
  isAdaptiveModeAuthBlocked,
  requiresAdaptiveModeAuth
} from '@/lib/search-mode-availability'
import { UploadedFile } from '@/lib/types'
import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import type { ModelSelectorData } from '@/lib/types/model-selector'
import type { SearchMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import {
  getCookie,
  setCookie,
  subscribeToCookieChange
} from '@/lib/utils/cookies'

import { useArtifact } from './artifact/artifact-context'
import { Button } from './ui/button'
import { IconBlinkingLogo } from './ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip'
import { ActionButtons } from './action-buttons'
import { FileUploadButton } from './file-upload-button'
import { MessageNavigationDots } from './message-navigation-dots'
import { ModelSelectorClient } from './model-selector-client'
import { SearchModeSelector } from './search-mode-selector'
import { UploadedFileList } from './uploaded-file-list'

// Constants for timing delays
const INPUT_UPDATE_DELAY_MS = 10 // Delay to ensure input value is updated before form submission
// Only paste events at/over this size (or line count) become a content card,
// so short/normal pastes stay inline.
const PASTE_CARD_MIN_CHARS = 400
const PASTE_CARD_MIN_LINES = 6
// A paste that is a single bare URL becomes a lightweight favicon chip.
// L0 prototype: client-only, no fetch — the URL rides into the query at send
// time so the existing fetch tool picks it up.
const BARE_URL_RE = /^https?:\/\/\S+$/

function getSearchModeSnapshot(): SearchMode {
  return getCookie('searchMode') === 'adaptive' ? 'adaptive' : 'quick'
}

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
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  /** Callback to reset chatId when starting a new chat */
  onNewChat?: () => void
  /** Whether the current session is guest */
  isGuest?: boolean
  /** Whether the deployment is cloud mode */
  isCloudDeployment?: boolean
  onAdaptiveModeAuthRequired?: () => void
  modelSelectorData?: ModelSelectorData
  /** Chat sections for message navigation dots */
  sections?: { id: string; userMessage: UIMessage }[]
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
  showScrollToBottomButton,
  uploadedFiles,
  setUploadedFiles,
  scrollContainerRef,
  onNewChat,
  isGuest = false,
  isCloudDeployment = false,
  onAdaptiveModeAuthRequired,
  modelSelectorData,
  sections = []
}: ChatPanelProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const [isInputFocused, setIsInputFocused] = useState(false) // Track input focus
  // Large pastes become separate "content cards" (the target), keeping the
  // textarea for the instruction. See PASTE_CARD_MIN_CHARS.
  const [contentCards, setContentCards] = useState<string[]>([])
  // A single pasted URL becomes a lightweight favicon chip (see BARE_URL_RE).
  const [urlCards, setUrlCards] = useState<string[]>([])
  const { close: closeArtifact } = useArtifact()
  const isLoading = status === 'submitted' || status === 'streaming'
  const hasAvailableModels =
    isCloudDeployment || modelSelectorData?.hasAvailableModels !== false
  const searchMode = useSyncExternalStore(
    subscribeToCookieChange,
    getSearchModeSnapshot,
    () => 'quick' as SearchMode
  )
  const isAdaptiveAuthRequired = requiresAdaptiveModeAuth({
    isGuest,
    isCloudDeployment
  })
  const adaptiveModeSubmitBlocked = isAdaptiveModeAuthBlocked({
    mode: searchMode,
    isGuest,
    isCloudDeployment
  })

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    // Brief debounce — the candidate-confirm Enter that fires
    // immediately after compositionend may otherwise be treated as a
    // submit. 50ms is enough to swallow that synchronous event but
    // short enough not to drop a real "finish typing, press Enter".
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 50)
  }

  const handleNewChat = useCallback(() => {
    setMessages([])
    closeArtifact()
    // Reset focus state when clearing chat
    setIsInputFocused(false)
    inputRef.current?.blur()
    // Reset chatId in parent component
    onNewChat?.()
    router.push('/')
  }, [setMessages, closeArtifact, onNewChat, router])

  // Listen for keyboard shortcut events
  // Uses defaultPrevented to prevent duplicate handling
  // when multiple ChatPanel instances are mounted (Next.js component caching)
  const handleNewChatRef = useRef(handleNewChat)
  useEffect(() => {
    handleNewChatRef.current = handleNewChat
  }, [handleNewChat])

  useEffect(() => {
    const handleNewChatShortcut = (e: Event) => {
      if (e.defaultPrevented) return
      e.preventDefault()
      handleNewChatRef.current()
    }

    window.addEventListener(SHORTCUT_EVENTS.newChat, handleNewChatShortcut)
    return () => {
      window.removeEventListener(SHORTCUT_EVENTS.newChat, handleNewChatShortcut)
    }
  }, [])

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
      if (adaptiveModeSubmitBlocked) {
        setCookie('searchMode', 'quick')
        return
      }

      append({
        role: 'user',
        parts: [{ type: 'text', text: query }]
      })
      isFirstRender.current = false
    }
  }, [adaptiveModeSubmitBlocked, append, query])

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
        messages.length > 0
          ? 'sticky bottom-0 px-2 pb-2 md:pb-4'
          : 'px-4 md:px-6'
      )}
    >
      {messages.length === 0 && (
        <div className="mb-6 md:mb-10 flex flex-col items-center gap-2 md:gap-4">
          <IconBlinkingLogo className="size-12" />
          <h1 className="text-xl md:text-2xl font-medium text-foreground">
            What would you like to know?
          </h1>
        </div>
      )}
      {uploadedFiles.length > 0 && (
        <UploadedFileList files={uploadedFiles} onRemove={handleFileRemove} />
      )}
      <form
        onSubmit={e => {
          // Pasted attachments (content cards / URL chips) are sent as
          // structured data parts alongside the instruction text part — no
          // in-band markers. The server maps them to the model prompt.
          if (contentCards.length > 0 || urlCards.length > 0) {
            e.preventDefault()
            if (adaptiveModeSubmitBlocked) {
              onAdaptiveModeAuthRequired?.()
              return
            }
            if (!hasAvailableModels) {
              toast.error('No enabled model is available')
              return
            }
            const uploaded = uploadedFiles.filter(f => f.status === 'uploaded')
            const parts = [
              ...contentCards.map(text => ({
                type: 'data-pastedContent',
                data: { text }
              })),
              ...urlCards.map(url => ({
                type: 'data-sourceUrl',
                data: { url }
              })),
              ...uploaded.map(f => ({
                type: 'file',
                url: f.url!,
                filename: f.name!,
                mediaType: f.file.type
              })),
              ...(input.trim() ? [{ type: 'text', text: input }] : [])
            ]
            if (contentCards.length > 0) {
              captureClient('content_card_submitted', {
                cardCount: contentCards.length,
                chars: contentCards.reduce((sum, c) => sum + c.length, 0)
              })
            }
            if (urlCards.length > 0) {
              captureClient('url_card_submitted', {
                cardCount: urlCards.length
              })
            }
            setContentCards([])
            setUrlCards([])
            setUploadedFiles([])
            handleInputChange({
              target: { value: '' }
            } as React.ChangeEvent<HTMLTextAreaElement>)
            append({ role: 'user', parts })
            setIsInputFocused(false)
            inputRef.current?.blur()
            return
          }
          if (adaptiveModeSubmitBlocked) {
            e.preventDefault()
            onAdaptiveModeAuthRequired?.()
            return
          }

          if (!hasAvailableModels) {
            e.preventDefault()
            toast.error('No enabled model is available')
            return
          }
          handleSubmit(e)
          // Reset focus state after submission
          setIsInputFocused(false)
          inputRef.current?.blur()
        }}
        className={cn('max-w-full md:max-w-3xl w-full mx-auto relative')}
      >
        {/* Scroll to bottom button */}
        {messages.length > 0 && (
          <div
            className={cn(
              'transition-opacity duration-[120ms] ease-[var(--motion-ease-out)]',
              showScrollToBottomButton
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -top-10 right-0 z-20 size-8 rounded-full shadow-md"
              onClick={handleScrollToBottom}
              title="Scroll to bottom"
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        )}
        {/* Message navigation dots */}
        {sections.length > 0 && (
          <div
            className={cn(
              'transition-opacity duration-[120ms] ease-[var(--motion-ease-out)]',
              !showScrollToBottomButton && status === 'ready'
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'
            )}
          >
            <MessageNavigationDots sections={sections} />
          </div>
        )}

        <div
          className={cn(
            'relative flex w-full flex-col gap-2 rounded-3xl border border-input bg-muted transition-[box-shadow] duration-[140ms] ease-[var(--motion-ease-out)]',
            isInputFocused &&
              'ring-1 ring-ring/20 ring-offset-1 ring-offset-background/50'
          )}
        >
          {contentCards.length > 0 && (
            <div className="flex flex-col gap-1.5 px-3 pt-3">
              {contentCards.map((card, i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-input bg-background px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileText className="size-3.5 shrink-0" />
                      Pasted content · {card.length.toLocaleString()} chars
                    </span>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Expand to text"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              captureClient('content_card_expanded', {
                                chars: card.length
                              })
                              setContentCards(prev =>
                                prev.filter((_, j) => j !== i)
                              )
                              handleInputChange({
                                target: {
                                  value: input ? `${input}\n\n${card}` : card
                                }
                              } as React.ChangeEvent<HTMLTextAreaElement>)
                              inputRef.current?.focus()
                            }}
                          >
                            <ArrowsDiagonal className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          Expand to text
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground/80">
                    {card}
                  </p>
                </div>
              ))}
            </div>
          )}
          {urlCards.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {urlCards.map((url, i) => {
                let host = url
                try {
                  host = new URL(url).host.replace(/^www\./, '')
                } catch {}
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background py-1 pl-2 pr-1 text-xs text-muted-foreground"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                      alt=""
                      width={14}
                      height={14}
                      className="size-3.5 shrink-0 rounded-sm"
                    />
                    <span className="max-w-[180px] truncate">{host}</span>
                    <button
                      type="button"
                      aria-label="Remove URL"
                      className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        captureClient('url_card_removed')
                        setUrlCards(prev => prev.filter((_, j) => j !== i))
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder={messages.length > 0 ? 'Reply...' : 'Ask anything...'}
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-3 md:p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
            onChange={handleInputChange}
            onPaste={e => {
              const text = e.clipboardData.getData('text')
              const trimmed = text.trim()
              // Only when the textarea is empty — a URL pasted mid-sentence
              // should stay inline, not get yanked into a chip.
              if (BARE_URL_RE.test(trimmed) && input.trim().length === 0) {
                e.preventDefault()
                setUrlCards(prev => [...prev, trimmed])
                captureClient('url_card_created')
                return
              }
              const lineCount = text.split('\n').length
              if (
                text.length >= PASTE_CARD_MIN_CHARS ||
                lineCount >= PASTE_CARD_MIN_LINES
              ) {
                e.preventDefault()
                setContentCards(prev => [...prev, text])
                captureClient('content_card_created', {
                  chars: text.length,
                  lines: lineCount
                })
              }
            }}
            onKeyDown={e => {
              // e.nativeEvent.isComposing stays true on the keydown that
              // confirms an IME candidate, even after React-level
              // isComposing has flipped.
              if (
                e.key !== 'Enter' ||
                isComposing ||
                (e.nativeEvent as KeyboardEvent).isComposing ||
                enterDisabled
              ) {
                return
              }

              // Plain Enter (no modifiers) → submit
              if (!e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
                if (input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
                setIsInputFocused(false)
                textarea.blur()
                return
              }

              // Shift+Enter falls through to textarea default (inserts \n).
              // Alt/Option+Enter on macOS does NOT insert \n by default,
              // so insert it manually to match user expectation.
              if (e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                const start = textarea.selectionStart ?? input.length
                const end = textarea.selectionEnd ?? input.length
                const next = input.slice(0, start) + '\n' + input.slice(end)
                handleInputChange({
                  target: { value: next }
                } as React.ChangeEvent<HTMLTextAreaElement>)
                requestAnimationFrame(() => {
                  textarea.selectionStart = textarea.selectionEnd = start + 1
                })
              }
            }}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-2 md:p-3">
            <div className="flex items-center gap-2">
              {!isGuest && (
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
              )}
              <SearchModeSelector
                isAdaptiveAuthRequired={isAdaptiveAuthRequired}
                onAdaptiveAuthRequired={onAdaptiveModeAuthRequired}
              />
            </div>
            <div className="flex items-center gap-2">
              {!isCloudDeployment && modelSelectorData && (
                <ModelSelectorClient data={modelSelectorData} />
              )}
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 size-8 md:size-10 rounded-full group"
                  type="button"
                  disabled={isLoading}
                >
                  <MessageCirclePlus className="size-4 transition-transform duration-[140ms] ease-[var(--motion-ease-out)] group-hover:rotate-12" />
                </Button>
              )}
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                className={cn(
                  isLoading && 'animate-pulse',
                  'size-8 md:size-10 rounded-full'
                )}
                disabled={
                  (input.length === 0 && !isLoading) || !hasAvailableModels
                }
                onClick={isLoading ? stop : undefined}
                title={
                  hasAvailableModels
                    ? undefined
                    : 'No enabled model is available'
                }
              >
                {isLoading ? (
                  <Square className="size-4 md:size-5" />
                ) : (
                  <ArrowUp className="size-4 md:size-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Action buttons for prompt suggestions */}
        {messages.length === 0 && (
          <ActionButtons
            onSelectPrompt={message => {
              // Set the input value and submit
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
              // Submit the form after a small delay to ensure the input is updated
              setTimeout(() => {
                inputRef.current?.form?.requestSubmit()
                // Reset focus state after action button submission
                setIsInputFocused(false)
                inputRef.current?.blur()
              }, INPUT_UPDATE_DELAY_MS)
            }}
            onCategoryClick={category => {
              // Set the category in the input
              handleInputChange({
                target: { value: category }
              } as React.ChangeEvent<HTMLTextAreaElement>)
              // Focus the input
              inputRef.current?.focus()
            }}
            inputRef={inputRef}
            className="mt-2 hidden md:block"
          />
        )}
      </form>
    </div>
  )
}
