import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'

export default async function Page() {
  const models = await getModels()
  return <Chat id="new" models={models} />
}
