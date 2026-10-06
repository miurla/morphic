import { useAppUser } from '@/lib/contexts/app-user-context'

export const useCurrentUserImage = () => {
  const user = useAppUser()

  return user?.image ?? null
}
