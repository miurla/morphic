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
  return <UserContext value={hasUser}>{children}</UserContext>
}

export function useHasUser() {
  return useContext(UserContext)
}
