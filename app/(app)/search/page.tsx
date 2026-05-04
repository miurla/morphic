import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'
import { generateUUID } from '@/lib/utils'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/chat')
  }

  const id = generateUUID()
  const userId = await getCurrentUserId()
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      id={id}
      query={q}
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      modelSelectorData={modelSelectorData}
    />
  )
}
