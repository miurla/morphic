'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'

import { cn } from '@/lib/utils'

import { useHasUser } from '@/lib/contexts/user-context'

import { IconLogo } from '@/components/ui/icons'

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const hasUser = useHasUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-md border-b border-border/60 shadow-xs'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 select-none">
          <IconLogo className="size-6" />
          <span className="font-semibold text-base tracking-tight">Morphic</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link
            href="https://github.com/miurla/morphic"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Icon icon="solar:code-bold" className="size-3.5" />
            GitHub
          </Link>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          {hasUser ? (
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to app
              <Icon icon="solar:alt-arrow-right-bold" className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                Sign in
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get started
                <Icon icon="solar:alt-arrow-right-bold" className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
