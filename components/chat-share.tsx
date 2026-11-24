'use client'

import { useState, useTransition } from 'react'

import { IconShare as Share } from '@tabler/icons-react'
import { toast } from 'sonner'

import { shareChat } from '@/lib/actions/chat'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import { useI18n } from '@/components/language-provider'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog'
import { Spinner } from './ui/spinner'

interface ChatShareProps {
  chatId: string
  className?: string
}

export function ChatShare({ chatId, className }: ChatShareProps) {
  const { t } = useI18n()

  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { copyToClipboard } = useCopyToClipboard({ timeout: 1000 })
  const [shareUrl, setShareUrl] = useState('')

  const handleShare = async () => {
    startTransition(() => {
      setOpen(true)
    })

    const sharedChatObject = await shareChat(chatId)
    if (!sharedChatObject) {
      toast.error(
        t(
          'Failed to make chat public. You may need to be logged in or own the chat.'
        )
      )
      return
    }

    const url = new URL(
      `/search/${sharedChatObject.id}`,
      window.location.origin
    )
    setShareUrl(url.toString())
  }

  const handleCopy = () => {
    if (shareUrl) {
      copyToClipboard(shareUrl)
      toast.success(t('Link copied to clipboard'))
      setOpen(false)
    } else {
      toast.error(t('No link to copy'))
    }
  }

  return (
    <div className={className}>
      <Dialog
        open={open}
        onOpenChange={open => setOpen(open)}
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-description"
      >
        <DialogTrigger asChild>
          <Button
            className={cn('rounded-full')}
            size="icon"
            variant={'ghost'}
            onClick={() => setOpen(true)}
          >
            <Share size={14} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Share Chat')}</DialogTitle>
            <DialogDescription>
              {t(
                "Anyone with the link will be able to view this chat if it's public."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="items-center">
            {!shareUrl && (
              <Button onClick={handleShare} disabled={pending} size="sm">
                {pending ? <Spinner /> : t('Get link')}
              </Button>
            )}
            {shareUrl && (
              <Button onClick={handleCopy} disabled={pending} size="sm">
                {t('Copy link')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
