import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export default async function Page() {
  const userId = await getCurrentUserId()
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const libraryAvailable = process.env.ENABLE_AUTH !== 'false'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      libraryAvailable={libraryAvailable}
      modelSelectorData={modelSelectorData}
    />
  )
}
