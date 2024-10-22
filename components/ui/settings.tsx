'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useChatHistory } from '@/lib/utils/chat-history-context'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { chatHistoryEnabled, setChatHistoryEnabled, isLoading } = useChatHistory()

  const handleChatHistoryToggle = async (checked: boolean) => {
    await setChatHistoryEnabled(checked)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="chat-history" className="text-sm font-medium">
              Enable Chat History
            </Label>
            {isLoading ? (
              <div>Loading...</div>
            ) : (
              <Switch
                id="chat-history"
                checked={chatHistoryEnabled}
                onCheckedChange={handleChatHistoryToggle}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
