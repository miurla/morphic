'use client'

import { useState, useTransition } from 'react'

import { Frown, Meh, Smile } from 'lucide-react'
import { toast } from 'sonner'

import { submitFeedback } from '@/lib/actions/site-feedback'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type Sentiment = 'positive' | 'neutral' | 'negative'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!sentiment || !message.trim()) {
      toast.error('Please select your sentiment and write a message')
      return
    }

    startTransition(async () => {
      const result = await submitFeedback({
        sentiment,
        message: message.trim(),
        pageUrl: window.location.href
      })

      if (result.success) {
        toast.success('Thank you for your feedback!')
        // Reset form and close modal
        setSentiment(null)
        setMessage('')
        onOpenChange(false)
      } else {
        toast.error('Failed to submit feedback. Please try again later.')
      }
    })
  }

  const handleCancel = () => {
    setSentiment(null)
    setMessage('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Give feedback</DialogTitle>
          <DialogDescription>
            Your feedback helps us improve Morphic. Let us know what you think!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sentiment === 'positive' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setSentiment('positive')}
              className={cn(
                'h-12 w-12',
                sentiment === 'positive' && 'bg-green-500 hover:bg-green-600'
              )}
            >
              <Smile className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              variant={sentiment === 'neutral' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setSentiment('neutral')}
              className={cn(
                'h-12 w-12',
                sentiment === 'neutral' && 'bg-yellow-500 hover:bg-yellow-600'
              )}
            >
              <Meh className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              variant={sentiment === 'negative' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setSentiment('negative')}
              className={cn(
                'h-12 w-12',
                sentiment === 'negative' && 'bg-red-500 hover:bg-red-600'
              )}
            >
              <Frown className="h-6 w-6" />
            </Button>
          </div>

          <Textarea
            placeholder="Your feedback"
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="min-h-[150px] resize-none"
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !sentiment || !message.trim()}
            >
              {isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
