import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export default async function ChatPage() {
  const userId = await getCurrentUserId()
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      modelSelectorData={modelSelectorData}
    />
  )
}
