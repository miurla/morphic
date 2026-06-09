'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconCopy as Copy,
  IconPencil as Pencil
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'
import { CollapsibleMessage } from './collapsible-message'
import { PastedContentCard } from './pasted-parts'

// Legacy: old messages carry pasted material wrapped in <user-content> tags
// (new messages use `data-pastedContent` parts). Split it out so we can render
// it as a collapsed card and keep the instruction as the prominent text.
const PASTED_RE = /<user-content>\n?([\s\S]*?)\n?<\/user-content>/g

function splitPastedContent(content: string): {
  cards: string[]
  rest: string
} {
  const cards: string[] = []
  const rest = content
    .replace(PASTED_RE, (_, body: string) => {
      cards.push(body)
      return ''
    })
    .trim()
  return { cards, rest }
}

interface UserTextSectionProps {
  content: string
  messageId?: string
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
}

export const UserTextSection: React.FC<UserTextSectionProps> = ({
  content,
  messageId,
  onUpdateMessage
}) => {
  const { cards, rest } = splitPastedContent(content)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(rest)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const enterResetTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setIsClamped(node.scrollHeight > node.clientHeight)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (enterResetTimeoutRef.current) {
        clearTimeout(enterResetTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — silently ignore
    }
  }

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setEditedContent(rest)
    setIsEditing(true)
  }

  const handleCancelClick = () => {
    setIsEditing(false)
  }

  const handleSaveClick = async () => {
    if (!onUpdateMessage || !messageId) return

    setIsEditing(false)

    // Re-wrap the preserved pasted cards (target) with the edited instruction.
    const wrapped = [
      ...cards.map(c => `<user-content>\n${c}\n</user-content>`),
      editedContent
    ]
      .filter(s => s && s.trim())
      .join('\n\n')

    try {
      await onUpdateMessage(messageId, wrapped)
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  const handleTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key !== 'Enter') {
      return
    }

    // Any modifier (Shift / Alt / Meta / Ctrl) + Enter → let it insert a
    // newline instead of submitting the edit.
    // nativeEvent.isComposing catches the IME candidate-confirm Enter even
    // after React-level isComposing has flipped.
    if (
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      isComposing ||
      (event.nativeEvent as KeyboardEvent).isComposing ||
      enterDisabled
    ) {
      // Alt+Enter on macOS does not insert \n by default; do it manually.
      if (event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        const textarea = event.target as HTMLTextAreaElement
        const start = textarea.selectionStart ?? editedContent.length
        const end = textarea.selectionEnd ?? editedContent.length
        const next =
          editedContent.slice(0, start) + '\n' + editedContent.slice(end)
        setEditedContent(next)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1
        })
      }
      return
    }

    event.preventDefault()
    void handleSaveClick()
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    if (enterResetTimeoutRef.current) {
      clearTimeout(enterResetTimeoutRef.current)
    }
    enterResetTimeoutRef.current = setTimeout(() => {
      setEnterDisabled(false)
      enterResetTimeoutRef.current = null
    }, 50)
  }

  return (
    <CollapsibleMessage role="user">
      <div
        className="flex-1 break-words w-full group outline-hidden relative"
        tabIndex={0}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2">
            {cards.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {cards.map((c, i) => (
                  <PastedContentCard key={i} text={c} />
                ))}
              </div>
            )}
            <TextareaAutosize
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              autoFocus
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={handleTextareaKeyDown}
              className="resize-none flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              minRows={2}
              maxRows={10}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancelClick}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveClick}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            {cards.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {cards.map((c, i) => (
                  <PastedContentCard key={i} text={c} />
                ))}
              </div>
            )}
            <div
              ref={contentRef}
              className={cn(
                'whitespace-pre-wrap',
                !isExpanded && 'line-clamp-3'
              )}
            >
              {rest}
            </div>
            {(isClamped || isExpanded) && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground mt-1"
                onClick={() => setIsExpanded(prev => !prev)}
              >
                {isExpanded ? (
                  <span className="inline-flex items-center gap-0.5">
                    Show less <ChevronUp className="size-3" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5">
                    Show more <ChevronDown className="size-3" />
                  </span>
                )}
              </button>
            )}
            <div
              className={cn(
                'absolute -top-1 -right-1 flex items-center gap-0.5 p-0.5 transition-opacity bg-background rounded-full shadow-sm border',
                'opacity-0',
                'max-md:group-focus-within:opacity-100',
                'md:group-hover:opacity-100'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full size-7"
                onMouseDown={e => e.preventDefault()}
                onClick={handleCopyClick}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full size-7"
                onMouseDown={e => e.preventDefault()}
                onClick={handleEditClick}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleMessage>
  )
}
