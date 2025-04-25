import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'

export const maxDuration = 60

export async function generateMetadata(props: { params: { id: string } }) {
  const { id } = await props.params
  return { title: 'Chat' }
}

export default async function ChatPage(props: { params: { id: string } }) {
  const { id } = await props.params

  const models = await getModels()

  return <Chat id={id} models={models} />
}
