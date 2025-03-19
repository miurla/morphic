'use client'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import React, { useEffect, useState } from 'react'
import { LoginModal } from './auth/login-modal'
import { UserAccountNav } from './auth/user-account-nav'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'

export const Header: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <header className="fixed w-full p-2 flex justify-between items-center z-10 backdrop-blur-md bg-background/60 transition-all duration-200">
      <div>
        <a
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-all duration-200"
        >
          <IconLogo
            className={cn(
              'w-6 h-6 text-primary hover:scale-110 transition-transform duration-200'
            )}
          />
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">
            Lucid
          </span>
        </a>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <UserAccountNav user={user} />
        ) : (
          <Button variant="outline" onClick={() => setShowLoginModal(true)}>
            Login
          </Button>
        )}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </div>
      {/* <History /> */}
    </header>
  )
}

export default Header
