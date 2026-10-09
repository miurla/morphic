import { useAppUser } from '@/lib/contexts/app-user-context'

export const useCurrentUserName = () => {
  const user = useAppUser()

  return user?.name || '?'
}
