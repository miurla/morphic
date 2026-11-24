import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'

import { getChatMeta } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { isAnonymousMode } from '@/lib/auth/provider'
import { getI18n } from '@/lib/i18n/server'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export const maxDuration = 60

// Dedupe the read shared by generateMetadata and the page within one request
const getChat = cache(getChatMeta)

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { t } = await getI18n()
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await getChat(id, userId)

  if (!chat) {
    return { title: t('Search') }
  }

  return {
    title: chat.title.toString().slice(0, 50) || t('Search')
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await getChat(id, userId)

  if (!chat) {
    // A logged-out visitor cannot tell a private chat from a missing one:
    // both are hidden behind null by the permission check in the loader.
    // Send them to sign in (the owner can then open their private link)
    // instead of a dead-end 404; public chats render above without a
    // login bounce. The ?next= carries the chat back through the login.
    if (!userId) {
      redirect(`/auth/login?next=${encodeURIComponent(`/search/${id}`)}`)
    }
    notFound()
  }

  if (chat.visibility === 'private' && !userId) {
    redirect(`/auth/login?next=${encodeURIComponent(`/search/${id}`)}`)
  }

  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const libraryAvailable = !isAnonymousMode()
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      id={id}
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      libraryAvailable={libraryAvailable}
      modelSelectorData={modelSelectorData}
    />
  )
}
