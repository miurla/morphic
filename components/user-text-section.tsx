'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import { Check, ChevronDown, ChevronUp, Copy, Pencil } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'
import { CollapsibleMessage } from './collapsible-message'

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
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
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
    setEditedContent(content)
    setIsEditing(true)
  }

  const handleCancelClick = () => {
    setIsEditing(false)
  }

  const handleSaveClick = async () => {
    if (!onUpdateMessage || !messageId) return

    setIsEditing(false)

    try {
      await onUpdateMessage(messageId, editedContent)
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

    if (event.shiftKey || isComposing || enterDisabled) {
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
    }, 300)
  }

  return (
    <CollapsibleMessage role="user">
      <div
        className="flex-1 break-words w-full group outline-hidden relative"
        tabIndex={0}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2">
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
            <div
              ref={contentRef}
              className={cn(
                'whitespace-pre-wrap',
                !isExpanded && 'line-clamp-3'
              )}
            >
              {content}
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
