'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import {
  IconDots as MoreHorizontal,
  IconTrash as Trash2
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { deleteChat } from '@/lib/actions/chat'
import { chatStore } from '@/lib/chat-store'
import { Chat as DBChat } from '@/lib/db/schema'
import type { Locale } from '@/lib/i18n/config'
import { localizeErrorMessage } from '@/lib/i18n/errors'
import { createTranslator } from '@/lib/i18n/translate'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'

import { useI18n } from '@/components/language-provider'

import { Spinner } from '../ui/spinner'

interface ChatMenuItemProps {
  chat: DBChat
}

const formatDateWithTime = (date: Date | string, locale: Locale) => {
  const t = createTranslator(locale)
  const parsedDate = new Date(date)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const formatTime = (date: Date) => {
    return date.toLocaleString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale === 'en'
    })
  }

  if (
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear()
  ) {
    return t('Today, {time}', { time: formatTime(parsedDate) })
  } else if (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  ) {
    return t('Yesterday, {time}', { time: formatTime(parsedDate) })
  } else {
    return parsedDate.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale === 'en'
    })
  }
}

export function ChatMenuItem({ chat }: ChatMenuItemProps) {
  const { t, locale } = useI18n()

  const pathname = usePathname()
  const path = `/search/${chat.id}`
  const isActive = pathname === path
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)

  const handleDeleteChat = useCallback(() => {
    // Close overlays first so focus and pointer locks are released
    // before the list updates and this item potentially unmounts.
    setIsAlertOpen(false)
    setIsMenuOpen(false)

    startTransition(async () => {
      const result = await deleteChat(chat.id)

      if (result?.success) {
        chatStore.remove(chat.id)
        toast.success(t('Chat deleted'))
        if (isActive) {
          router.push('/')
        }
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } else if (result?.error) {
        toast.error(localizeErrorMessage(locale, result.error))
      } else {
        toast.error(t('An unexpected error occurred while deleting the chat.'))
      }
    })
  }, [chat.id, isActive, router, startTransition, t, locale])
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setIsMenuOpen(open)
  }, [])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="h-auto flex-col gap-0.5 items-start p-2 pr-8"
      >
        <Link href={path}>
          <div className="text-xs font-medium truncate select-none w-full">
            {chat.title}
          </div>
          <div className="text-xs text-muted-foreground w-full">
            {formatDateWithTime(chat.createdAt, locale)}
          </div>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className="size-7 p-1 mr-1">
            <MoreHorizontal size={16} />
            <span className="sr-only">{t('Chat Actions')}</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={event => {
              event.preventDefault()
              setIsMenuOpen(false)
              setIsAlertOpen(true)
            }}
          >
            <Trash2 size={14} />
            {t('Delete Chat')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you absolutely sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This action cannot be undone. This will permanently delete this chat history.'
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
                handleDeleteChat()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <div className="flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                t('Delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  )
}
