'use client'

import { cn } from '@/lib/utils'
import { Pencil } from 'lucide-react'
import React, { useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { CollapsibleMessage } from './collapsible-message'
import { Button } from './ui/button'

type UserMessageProps = {
  message: string
  messageId?: string
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  messageId,
  onUpdateMessage
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message)

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setEditedContent(message)
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

  return (
    <CollapsibleMessage role="user">
      <div
        className="flex-1 break-words w-full group outline-none relative"
        tabIndex={0}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <TextareaAutosize
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              autoFocus
              className="resize-none flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="flex justify-between items-start">
            <div className="flex-1">{message}</div>
            <div
              className={cn(
                'absolute top-1 right-1 transition-opacity ml-2',
                'opacity-0',
                'group-focus-within:opacity-100',
                'md:opacity-0',
                'md:group-hover:opacity-100'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-7 w-7"
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
