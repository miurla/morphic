import { generateId } from '@/lib/db/schema'

import { ChangelogBanner } from '@/components/changelog-banner'
import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateId()
  return (
    <>
      <Chat id={id} />
      <ChangelogBanner />
    </>
  )
}
