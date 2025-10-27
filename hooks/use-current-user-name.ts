import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export const useCurrentUserName = () => {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfileName = async () => {
      try {
        const { data, error } = await createClient().auth.getSession()
        if (error) {
          console.error(error)
        }
        setName(data.session?.user.user_metadata.full_name ?? '?')
      } catch (error) {
        // Supabase not configured
        setName('Anonymous')
      }
    }

    fetchProfileName()
  }, [])

  return name || '?'
}
