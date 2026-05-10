'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { Activity, Heart, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteChat } from '@/lib/actions/chat'
import { Chat as DBChat } from '@/lib/db/schema'
import {
  createHeartbeat,
  hasHeartbeat as checkHasHeartbeat
} from '@/lib/heartbeat/store'

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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'

import { Spinner } from '../ui/spinner'

interface ChatMenuItemProps {
  chat: DBChat
}

const formatDateWithTime = (date: Date | string) => {
  const parsedDate = new Date(date)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  if (
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${formatTime(parsedDate)}`
  } else if (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${formatTime(parsedDate)}`
  } else {
    return parsedDate.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
}

export function ChatMenuItem({ chat }: ChatMenuItemProps) {
  const pathname = usePathname()
  const path = `/search/${chat.id}`
  const isActive = pathname === path
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [hasHb, setHasHb] = useState(false)

  useEffect(() => {
    checkHasHeartbeat(chat.id).then(setHasHb)
    const handler = () => {
      checkHasHeartbeat(chat.id).then(setHasHb)
    }
    window.addEventListener('heartbeat-updated', handler)
    return () => window.removeEventListener('heartbeat-updated', handler)
  }, [chat.id])

  const handleDeleteChat = useCallback(() => {
    setIsAlertOpen(false)
    setIsMenuOpen(false)

    startTransition(async () => {
      const result = await deleteChat(chat.id)

      if (result?.success) {
        toast.success('Chat deleted')
        if (isActive) {
          router.push('/')
        }
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } else if (result?.error) {
        toast.error(result.error)
      } else {
        toast.error('An unexpected error occurred while deleting the chat.')
      }
    })
  }, [chat.id, isActive, router, startTransition])

  const handleCreateHeartbeat = useCallback(async () => {
    setIsMenuOpen(false)
    await createHeartbeat({
      chatId: chat.id,
      chatTitle: chat.title ?? 'Sans titre',
      query: chat.title ?? '',
      frequency: 'daily',
      channel: 'whatsapp'
    })
    toast.success('Heartbeat créé', {
      description: 'Cette conversation sera relancée quotidiennement.'
    })
  }, [chat.id, chat.title])

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
          <div className="flex items-center gap-1.5 text-xs font-medium truncate select-none w-full">
            {hasHb && (
              <Activity className="size-3 text-green-500 shrink-0 animate-pulse" />
            )}
            <span className="truncate">{chat.title}</span>
          </div>
          <div className="text-xs text-muted-foreground w-full">
            {formatDateWithTime(chat.createdAt)}
          </div>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className="size-7 p-1 mr-1">
            <MoreHorizontal size={16} />
            <span className="sr-only">Chat Actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {!hasHb && (
            <DropdownMenuItem
              className="gap-2"
              onSelect={event => {
                event.preventDefault()
                handleCreateHeartbeat()
              }}
            >
              <Heart size={14} />
              Créer un Heartbeat
            </DropdownMenuItem>
          )}
          {hasHb && (
            <DropdownMenuItem
              className="gap-2 text-green-600"
              onSelect={event => {
                event.preventDefault()
                setIsMenuOpen(false)
                router.push('/heartbeat')
              }}
            >
              <Activity size={14} />
              Voir le Heartbeat
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={event => {
              event.preventDefault()
              setIsMenuOpen(false)
              setIsAlertOpen(true)
            }}
          >
            <Trash2 size={14} />
            Delete Chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
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
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  )
}
