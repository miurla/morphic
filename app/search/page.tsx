import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'

export const maxDuration = 60

export default async function NewSearchPage() {
  const models = await getModels()

  return <Chat id="new" models={models} />
}
