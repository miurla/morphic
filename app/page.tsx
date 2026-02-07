import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { BetaBadge } from '@/components/beta-badge'
import { ChangelogBanner } from '@/components/changelog-banner'
import { Chat } from '@/components/chat'

export default async function Page() {
  const userId = await getCurrentUserId()
  return (
    <>
      <Chat isGuest={!userId} />
      <ChangelogBanner />
      <BetaBadge />
    </>
  )
}
