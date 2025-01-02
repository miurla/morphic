import { Chat } from '@/components/chat'
import { redirect } from 'next/navigation'

export const maxDuration = 60

export default function Page({
  searchParams
}: {
  searchParams: { q: string }
}) {
  if (!searchParams.q) {
    redirect('/')
  }

  return <Chat />
  // return <Chat initialInput={searchParams.q} />
}
