'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  IconDots as MoreHorizontal,
  IconTrash as Trash2
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { clearChats } from '@/lib/actions/chat'
import { chatStore } from '@/lib/chat-store'
import { localizeErrorMessage } from '@/lib/i18n/errors'

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

import { useI18n } from '@/components/language-provider'

interface ClearHistoryActionProps {
  empty: boolean
}

export function ClearHistoryAction({ empty }: ClearHistoryActionProps) {
  const { t, locale } = useI18n()

  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const router = useRouter()

  const handleClearAction = useCallback(() => {
    startTransition(async () => {
      const res = await clearChats()
      if (res?.success) {
        chatStore.clear()
        toast.success(t('History cleared'))
        router.push('/')
      } else if (res?.error) {
        toast.error(localizeErrorMessage(locale, res.error))
      }
      setIsAlertOpen(false)
      setIsMenuOpen(false)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
  }, [startTransition, router, t, locale])

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
          <span className="sr-only">{t('History Actions')}</span>
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
              <Trash2 size={14} />
              {t('Clear History')}
            </DropdownMenuItem>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Are you absolutely sure?')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  'This action cannot be undone. It will permanently delete your history.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>
                {t('Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={event => {
                  event.preventDefault()
                  handleClearAction()
                }}
              >
                {isPending ? <Spinner /> : t('Clear')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
