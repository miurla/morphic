'use client'

import { useSyncExternalStore } from 'react'

import {
  DEFAULT_SEARCH_PREFERENCES,
  getSearchPreferences,
  SearchPreferences,
  setSearchPreferences
} from '@/lib/config/search-preferences'
import { getCookie, subscribeToCookieChange } from '@/lib/utils/cookies'

const COOKIE_NAME = 'searchPreferences'

let cachedRawCookie: string | null | undefined
let cachedSnapshot: SearchPreferences | undefined

function getSnapshot(): SearchPreferences {
  const rawCookie = getCookie(COOKIE_NAME)
  if (cachedSnapshot && cachedRawCookie === rawCookie) {
    return cachedSnapshot
  }

  cachedRawCookie = rawCookie
  cachedSnapshot = getSearchPreferences()
  return cachedSnapshot
}

function getServerSnapshot(): SearchPreferences {
  return DEFAULT_SEARCH_PREFERENCES
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
