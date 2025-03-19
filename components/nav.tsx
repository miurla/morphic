'use client'

import { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { LoginModal } from './auth/login-modal'
import { UserAccountNav } from './auth/user-account-nav'
import { Button } from './ui/button'

export function Nav({ initialUser }: { initialUser?: User | null }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [user, setUser] = useState<User | null>(initialUser || null)

  return (
    <nav className="flex items-center justify-between p-4">
      {/* Your other nav items */}

      <div>
        {user ? (
          <UserAccountNav user={user} />
        ) : (
          <Button onClick={() => setIsLoginModalOpen(true)}>Sign in</Button>
        )}
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={user => setUser(user)}
      />
    </nav>
  )
}
