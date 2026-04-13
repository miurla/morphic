import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { getGravatarUrl } from '@/lib/utils/gravatar'

export const useCurrentUserImage = () => {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserImage = async () => {
      try {
        const { data, error } = await createClient().auth.getSession()
        if (error) {
          console.error(error)
        }
        const avatarUrl =
          data.session?.user.user_metadata.avatar_url ||
          data.session?.user.user_metadata.picture
        if (avatarUrl) {
          setImage(avatarUrl)
        } else if (data.session?.user.email) {
          const gravatarUrl = await getGravatarUrl(data.session.user.email)
          setImage(gravatarUrl)
        }
      } catch (error) {
        // Supabase not configured, skip silently
      }
    }
    fetchUserImage()
  }, [])

  return image
}
