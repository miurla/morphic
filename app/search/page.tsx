import { Chat } from '@/components/chat'
import { generateId } from 'ai'
import { AI } from '@/app/actions'
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
  const id = generateId()

  return (
    <AI initialAIState={{ chatId: id, messages: [] }}>
      <Chat id={id} query={searchParams.q} />
    </AI>
  )
}
