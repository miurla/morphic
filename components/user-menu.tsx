'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'
import { Link2, LogOut, Palette, Settings, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type DbUser = {
  id: string
  name: string | null
  email: string | null
  emailVerified: Date | null
  image: string | null
  role: string
  createdAt: Date
  updatedAt: Date
}
import { ExternalLinkItems } from './external-link-items'
import { ThemeMenuItems } from './theme-menu-items'
import { Button } from './ui/button'

interface UserMenuProps {
  user: DbUser
}

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const userName = user.name || 'User'
  const avatarUrl = user.image || undefined

  // Check if user is admin
  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL || 
                  user.email === 'admin@example.com'

  const getInitials = (name: string, email: string | null | undefined) => {
    if (name && name !== 'User') {
      const names = name.split(' ')
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback>{getInitials(userName, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {userName}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Admin Links */}
        {isAdmin && (
          <>
            <Link href="/admin">
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </DropdownMenuItem>
            </Link>
          </>
        )}
        
        {/* Show admin setup for non-admin users */}
        {!isAdmin && (
          <>
            <Link href="/admin-setup">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Admin Setup</span>
              </DropdownMenuItem>
            </Link>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="mr-2 h-4 w-4" />
            <span>Links</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
