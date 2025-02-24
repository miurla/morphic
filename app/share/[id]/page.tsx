import { Chat } from '@/components/chat'
import { getSharedChat } from '@/lib/actions/chat'
import modelsList from '@/lib/config/models.json'
import { Model } from '@/lib/types/models'
import { convertToUIMessages } from '@/lib/utils'
import { notFound } from 'next/navigation'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const chat = await getSharedChat(id)

  if (!chat || !chat.sharePath) {
    return notFound()
  }

  return {
    title: chat?.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SharePage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const chat = await getSharedChat(id)
  // convertToUIMessages for useChat hook
  const messages = convertToUIMessages(chat?.messages || [])

  if (!chat || !chat.sharePath) {
    notFound()
  }

  return (
    <Chat
      id={id}
      savedMessages={messages}
      models={modelsList.models as Model[]}
    />
  )
}
