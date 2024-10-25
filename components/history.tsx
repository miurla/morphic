'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { History as HistoryIcon } from 'lucide-react'
import { Suspense } from 'react'
import { HistorySkeleton } from './history-skeleton'
import { useAppState } from '@/lib/utils/app-state'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { ClientHistoryWrapper } from './client-history-wrapper'

type HistoryProps = {
  location: 'sidebar' | 'header'
  children?: React.ReactNode
}

export function History({ location }: HistoryProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { isGenerating } = useAppState()
  const { chatHistoryEnabled, refreshChatHistory, storageAvailable } = useChatHistory()

  const onOpenChange = async (open: boolean) => {
    if (open && chatHistoryEnabled && storageAvailable) {
      startTransition(async () => {
        try {
          await refreshChatHistory()
        } catch (error) {
          console.error('Failed to refresh chat history:', error)
        }
      })
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn({
            'rounded-full text-foreground/30': location === 'sidebar'
          })}
          disabled={isGenerating || isPending}
        >
          {location === 'header' ? <Menu /> : <ChevronLeft size={16} />}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-64 rounded-tl-xl rounded-bl-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1 text-sm font-normal mb-2">
            <HistoryIcon size={14} />
            History
          </SheetTitle>
        </SheetHeader>
        <div className="my-2 h-full pb-12 md:pb-10">
          <ClientHistoryWrapper userId="anonymous" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
