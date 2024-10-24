'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { updateChatHistorySetting } from '@/lib/actions/chat'

export function ChatHistoryToggle() {
  const { chatHistoryEnabled, setChatHistoryEnabled } = useChatHistory()

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
      />
      <Label htmlFor="chat-history">Enable Chat History</Label>
    </div>
  )
}
