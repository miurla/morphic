import { Chat } from '@/components/chat'
import { nanoid } from 'ai'
import { AI } from './actions'

export const runtime = 'edge'

export default function Page() {
  const id = nanoid()
  return (
    <AI initialAIState={{ chatId: id, messages: [] }}>
      <Chat id={id} />
    </AI>
  )
}
