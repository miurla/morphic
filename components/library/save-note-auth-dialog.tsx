'use client'

import Link from 'next/link'

import { IconBookmark as Bookmark } from '@tabler/icons-react'

import { captureClient } from '@/lib/analytics/posthog-client'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

export function SaveNoteAuthDialog({
  open,
  onOpenChange,
  source,
  chatId
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: string
  chatId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Bookmark className="size-6 text-muted-foreground" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold">
            Save notes to your library
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Sign in or create an account to save answers and selected text to
            your Library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2">
          <Button asChild className="w-full">
            <Link
              href="/auth/sign-up"
              onClick={() =>
                captureClient('library_auth_prompt_cta_clicked', {
                  source,
                  target: 'sign_up',
                  chatId
                })
              }
            >
              Sign Up
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link
              href="/auth/login"
              onClick={() =>
                captureClient('library_auth_prompt_cta_clicked', {
                  source,
                  target: 'sign_in',
                  chatId
                })
              }
            >
              Sign In
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
