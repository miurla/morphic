import { getCurrentUser, getCurrentUserId } from '@/lib/auth/get-current-user'

import { Chat } from '@/components/chat'

export default async function Page() {
  const [userId, user] = await Promise.all([
    getCurrentUserId(),
    getCurrentUser()
  ])
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    null
  return <Chat isGuest={!userId} userName={userName} />
}
