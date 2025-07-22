import { getModels } from '@/lib/config/models'
import { generateUUID } from '@/lib/utils'

import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateUUID()
  const models = await getModels()
  return <Chat id={id} models={models} />
}
