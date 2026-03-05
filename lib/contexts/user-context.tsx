'use client'

import { createContext, useContext } from 'react'

const UserContext = createContext(false)

export function UserProvider({
  hasUser,
  children
}: {
  hasUser: boolean
  children: React.ReactNode
}) {
  return <UserContext.Provider value={hasUser}>{children}</UserContext.Provider>
}

export function useHasUser() {
  return useContext(UserContext)
}
