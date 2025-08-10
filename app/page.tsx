import { getModels } from '@/lib/config/models'
import { generateId } from '@/lib/db/schema'

import { ChangelogBanner } from '@/components/changelog-banner'
import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateId()
  const models = await getModels()
  return (
    <>
      <Chat id={id} models={models} />
      <ChangelogBanner />
    </>
  )
}
