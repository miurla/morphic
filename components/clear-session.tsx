'use client'
import React, { useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ClearSession } from '@/lib/actions/chat'
import { toast } from 'sonner'
import { Spinner } from './ui/spinner'

type ClearChatProps = {
  chatId: string
  className?: string
}

export function ClearChat({ chatId, className }: ClearChatProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleClearChat = async () => {
    startTransition(async () => {
      const result = await ClearSession(chatId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Session Deleted')
      }
      setOpen(false)
    })
  }

  return (
    <div className={className}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the current session and remove this data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                handleClearChat()
              }}
            >
              {isPending ? <Spinner /> : 'Clear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
