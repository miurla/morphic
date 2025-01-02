import { notFound, redirect } from 'next/navigation'
import { Chat } from '@/components/chat'
import { getChat } from '@/lib/actions/chat'

export const maxDuration = 60

export interface SearchPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: SearchPageProps) {
  const chat = await getChat(params.id, 'anonymous')
  return {
    title: chat?.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SearchPage({ params }: SearchPageProps) {
  const userId = 'anonymous'
  const chat = await getChat(params.id, userId)

  if (!chat) {
    redirect('/')
  }

  if (chat?.userId !== userId) {
    notFound()
  }

  return <Chat />
}
