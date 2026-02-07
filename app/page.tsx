import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { Chat } from '@/components/chat'

export default async function Page() {
  const userId = await getCurrentUserId()
  return <Chat isGuest={!userId} />
}
