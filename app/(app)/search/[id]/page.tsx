import { notFound, redirect } from 'next/navigation'

import { UIMessage } from 'ai'

import { loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await loadChat(id, userId)

  if (!chat) {
    return { title: 'Search' }
  }

  return {
    title: chat.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await loadChat(id, userId)

  if (!chat) {
    notFound()
  }

  if (chat.visibility === 'private' && !userId) {
    redirect('/auth/login')
  }

  const messages: UIMessage[] = chat.messages
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      id={id}
      savedMessages={messages}
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      modelSelectorData={modelSelectorData}
    />
  )
}
