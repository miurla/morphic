'use client'

import { useSyncExternalStore } from 'react'

import {
  getSearchPreferences,
  SearchPreferences,
  setSearchPreferences
} from '@/lib/config/search-preferences'
import { subscribeToCookieChange } from '@/lib/utils/cookies'

function getSnapshot(): SearchPreferences {
  return getSearchPreferences()
}

function getServerSnapshot(): SearchPreferences {
  // Return defaults on server
  return getSearchPreferences()
}

export function useSearchPreferences() {
  const preferences = useSyncExternalStore(
    subscribeToCookieChange,
    getSnapshot,
    getServerSnapshot
  )

  return {
    preferences,
    setPreferences: (partial: Partial<SearchPreferences>) =>
      setSearchPreferences(partial)
  }
}
