import { Chat } from '@/components/chat'
import { getSharedChat } from '@/lib/actions/chat'
import { getModels } from '@/lib/config/models'
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

  if (!chat || !chat.sharePath) {
    return notFound()
  }

  const models = await getModels()
  return (
    <Chat
      id={chat.id}
      savedMessages={convertToUIMessages(chat.messages)}
      models={models}
    />
  )
}
