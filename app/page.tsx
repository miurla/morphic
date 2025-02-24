import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'
import { generateId } from 'ai'

export default function Page() {
  const id = generateId()
  const models = getModels()
  return <Chat id={id} models={models} />
}
