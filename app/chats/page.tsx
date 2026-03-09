import { getCurrentUser } from '@/lib/auth/get-current-user'

import { ChatsPageClient } from './chats-page-client'

export const metadata = {
  title: "Chats | Borsatti's"
}

export default async function ChatsPage() {
  const user = await getCurrentUser()
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    null

  return <ChatsPageClient userName={userName} />
}
