import { generateId } from 'ai'

import { getModels } from '@/lib/config/models'

import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateId()
  const models = await getModels()
  return <Chat key={id} id={id} models={models} />
}
