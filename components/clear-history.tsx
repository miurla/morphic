'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from 'lucide-react'

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
import { clearChats } from '@/lib/actions/chat'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { toast } from 'sonner'
import { Spinner } from './ui/spinner'

type ClearHistoryProps = {
  empty: boolean
  onCleared?: () => void
}

export function ClearHistory({ empty, onCleared }: ClearHistoryProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { refreshChatHistory } = useChatHistory()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={empty || isPending}
          className="w-full justify-start"
        >
          <Trash className="mr-2 h-4 w-4" />
          Clear history
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            history and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={event => {
              event.preventDefault()
              startTransition(async () => {
                const result = await clearChats()
                if (result?.error) {
                  toast.error(result.error)
                } else {
                  await refreshChatHistory()
                  onCleared?.()
                  toast.success('History cleared')
                }
                setOpen(false)
              })
            }}
          >
            {isPending ? <Spinner /> : 'Clear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
