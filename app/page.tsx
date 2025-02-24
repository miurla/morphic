import { Chat } from '@/components/chat'
import modelsList from '@/lib/config/models.json'
import { Model } from '@/lib/types/models'
import { generateId } from 'ai'

export default function Page() {
  const id = generateId()
  return <Chat id={id} models={modelsList.models as Model[]} />
}
