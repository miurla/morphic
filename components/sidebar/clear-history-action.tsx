'use client'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarGroupAction } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { clearChats } from '@/lib/actions/chat-db'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

interface ClearHistoryActionProps {
  empty: boolean
}

export function ClearHistoryAction({ empty }: ClearHistoryActionProps) {
  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const router = useRouter()

  const handleClearAction = useCallback(() => {
    startTransition(async () => {
      const res = await clearChats()
      if (res?.success) {
        toast.success('History cleared')
        router.push('/')
      } else if (res?.error) {
        toast.error(res.error)
      }
      setIsAlertOpen(false)
      setIsMenuOpen(false)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
  }, [startTransition, router])

  const handleAlertOpenChange = useCallback(
    (open: boolean) => {
      setIsAlertOpen(open)
      if (!open) {
        setIsMenuOpen(false)
      }
    },
    [setIsAlertOpen, setIsMenuOpen]
  )

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      setIsMenuOpen(open)
      if (!open) {
        setIsAlertOpen(false)
      }
    },
    [setIsMenuOpen, setIsAlertOpen]
  )

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <SidebarGroupAction disabled={empty} className="static size-7 p-1">
          <MoreHorizontal size={16} />
          <span className="sr-only">History Actions</span>
        </SidebarGroupAction>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <AlertDialog open={isAlertOpen} onOpenChange={handleAlertOpenChange}>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              disabled={empty || isPending}
              className="gap-2 text-destructive focus:text-destructive"
              onSelect={event => {
                event.preventDefault()
              }}
            >
              <Trash2 size={14} /> Clear History
            </DropdownMenuItem>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. It will permanently delete your
                history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={event => {
                  event.preventDefault()
                  handleClearAction()
                }}
              >
                {isPending ? <Spinner /> : 'Clear'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
