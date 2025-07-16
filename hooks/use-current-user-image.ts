import { useSession } from 'next-auth/react'

export const useCurrentUserImage = () => {
  const { data: session } = useSession()
  
  return session?.user?.image || null
}
