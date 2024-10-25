'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { updateChatHistorySetting } from '@/lib/actions/chat'

export function ChatHistoryToggle() {
  const { chatHistoryEnabled, setChatHistoryEnabled, isLoading, storageAvailable } = useChatHistory()

  // If storage is not available, show message instead of toggle
  if (!storageAvailable) {
    return (
      <div className="flex flex-col space-y-2 mb-4 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Chat history is currently unavailable. To enable history functionality, please configure Redis storage in your environment settings.
        </p>
      </div>
    )
  }

  const handleToggle = async (checked: boolean) => {
    const success = await updateChatHistorySetting('anonymous', checked)
    if (success) {
      setChatHistoryEnabled(checked)
    }
  }

  return (
    <div className="flex items-center space-x-2 mb-4">
      <Switch
        id="chat-history"
        checked={chatHistoryEnabled}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />
      <Label htmlFor="chat-history">Enable Chat History</Label>
    </div>
  )
}
