import { Chat } from '@/components/chat'
import { redirect } from 'next/navigation'

export const maxDuration = 60

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  return <Chat />
  // return <Chat initialInput={searchParams.q} />
}
