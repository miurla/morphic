'use client'

import { useEffect, useState } from 'react'

import { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

export function useAuthCheck() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const checkAuth = async () => {
      try {
        const supabase = createClient()

        const {
          data: { session }
        } = await supabase.auth.getSession()
        setUser(session?.user ?? null)

        // Subscribe to auth changes
        const {
          data: { subscription: authSubscription }
        } = supabase.auth.onAuthStateChange((event, session) => {
          setUser(session?.user ?? null)
        })
        subscription = authSubscription
      } catch (error) {
        // Supabase not configured
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return { user, loading, isAuthenticated: !!user }
}
