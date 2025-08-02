import { AlertCircle } from 'lucide-react'

import { Card } from '@/components/ui/card'

interface ChatErrorProps {
  error: Error | string | null | undefined
}

export function ChatError({ error }: ChatErrorProps) {
  if (!error) return null

  const errorMessage = error instanceof Error ? error.message : error

  return (
    <Card className="border-destructive bg-destructive/10 p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive">{errorMessage}</p>
      </div>
    </Card>
  )
}
