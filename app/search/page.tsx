import { redirect } from 'next/navigation'

import { generateId } from 'ai'

import { getModels } from '@/lib/config/models'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = generateId()
  const models = await getModels()
  return <Chat id={id} query={q} models={models} />
}
