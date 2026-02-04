import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { generateUUID } from '@/lib/utils'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = generateUUID()
  const userId = await getCurrentUserId()
  return <Chat id={id} query={q} isGuest={!userId} />
}
