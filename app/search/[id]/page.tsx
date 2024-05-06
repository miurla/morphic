import { notFound, redirect } from 'next/navigation'
import { Chat } from '@/components/chat'
import { getChat } from '@/lib/actions/chat'
import { AI } from '@/app/actions'

export const runtime = 'edge'

export interface SearchPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: SearchPageProps) {
  const chat = await getChat(params.id, 'anonymous')
  const chatTitle = chat?.title.toString().slice(0, 50)
  const title = chatTitle || '信源AI助手 - 动态、复杂、高维数据的智能分析'
  const description = chatTitle
    ? '信源AI助手 - 动态、复杂、高维数据的智能分析'
    : '基于先进的数据+AI一体化引擎，赋能企业对运营生产动态的实时监控与掌握，实现生产经营的降本增益！'
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: title,
      type: 'website',
      images: [
        {
          url: `/opengraph-image.png`, // Must be an absolute URL
          width: 512,
          height: 512,
          alt: '信源AI助手'
        }
      ]
    }
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

  return (
    <AI initialAIState={{ chatId: chat.id, messages: chat.messages }}>
      <Chat id={params.id} />
    </AI>
  )
}
