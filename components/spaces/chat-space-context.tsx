'use client'

import { createContext, useContext } from 'react'

import type { ChatSpace } from '@/lib/spaces/space'

const ChatSpaceContext = createContext<ChatSpace | null>(null)

export const ChatSpaceProvider = ChatSpaceContext.Provider

/** The space of the chat being shown, or null for the default space. */
export function useChatSpace(): ChatSpace | null {
  return useContext(ChatSpaceContext)
}
