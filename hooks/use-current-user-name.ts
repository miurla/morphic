import { useSession } from 'next-auth/react'

export const useCurrentUserName = () => {
  const { data: session } = useSession()
  
  return session?.user?.name || '?'
}
