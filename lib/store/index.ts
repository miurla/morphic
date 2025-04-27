import { getCookie, setCookie } from '@/lib/utils/cookies'
import { create } from 'zustand'

export interface AppState {
  // Chat related state
  currentChatId: string | null
  setCurrentChatId: (chatId: string | null) => void

  // PMC Research Mode state
  isPmcResearchMode: boolean
  setIsPmcResearchMode: (value: boolean) => void
  initializePmcModeFromCookie: () => void // Action to read cookie on client
}

// Helper function to safely get cookie value only on client-side
const getInitialPmcMode = (): boolean => {
  if (typeof window === 'undefined') {
    console.warn(
      '[getInitialPmcMode] Called on server, returning default true.'
    )
    return true
  }
  const savedMode = getCookie('search-mode')
  return savedMode !== null ? savedMode === 'true' : true
}

export const useAppStore = create<AppState>((set, get) => ({
  // --- Chat State ---
  currentChatId: null,
  setCurrentChatId: chatId => {
    console.log('[Zustand Store] Setting currentChatId:', chatId)
    set({ currentChatId: chatId })
  },

  // --- PMC Research Mode State ---
  // Set a simple default here, the correct value will be set by initializePmcModeFromCookie on client
  isPmcResearchMode: true,

  setIsPmcResearchMode: value => {
    const currentState = get().isPmcResearchMode
    if (value !== currentState) {
      console.log(`[Zustand Store] Setting isPmcResearchMode to: ${value}`)
      set({ isPmcResearchMode: value })
      // Also update the cookie whenever the state changes
      setCookie('search-mode', value.toString())
    } else {
      console.log(
        `[Zustand Store] isPmcResearchMode already ${value}. No update.`
      )
    }
  },

  initializePmcModeFromCookie: () => {
    // This action should be called once on the client side
    console.log('[Zustand Store] Initializing PMC mode from cookie...')
    const cookieValue = getInitialPmcMode() // Call helper here, only runs client-side via useEffect
    const currentState = get().isPmcResearchMode
    console.log(
      `[Zustand Store] Cookie value: ${cookieValue}, Current store state: ${currentState}`
    )
    if (cookieValue !== currentState) {
      console.log('[Zustand Store] Setting initial PMC mode based on cookie.')
      set({ isPmcResearchMode: cookieValue })
    } else {
      console.log(
        '[Zustand Store] Initial PMC mode matches cookie. No update needed.'
      )
    }
  }
}))
