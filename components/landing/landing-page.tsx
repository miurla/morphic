'use client'

import Link from 'next/link'

import { ArrowRight } from 'lucide-react'

import { IconLogo } from '@/components/ui/icons'

import { useAuthModal } from '@/components/auth-modal'

export function LandingNavbar() {
  const { openAuthModal } = useAuthModal()

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 w-full px-6 py-4 md:px-12">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <IconLogo className="size-7" />
            <span className="text-lg font-bold tracking-tight">Melron</span>
            <span className="text-xs text-muted-foreground">AI networker</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/about-melron"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              What about Melron
            </Link>
            <Link
              href="/melron-mcp"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Melron MCP
            </Link>
            <Link
              href="/community"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Community
            </Link>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Blog
            </Link>
            <Link
              href="/affiliate-program"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Affiliates
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openAuthModal('signin')}
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            My Network
          </button>
          <Link
            href="/pricing"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get Premium
          </Link>
          <button
            type="button"
            onClick={() => openAuthModal('signin')}
            className="rounded-full border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Sign in
          </button>
        </div>
      </div>
    </nav>
  )
}

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Community', href: '/community' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Blog', href: '/blog' },
      { label: 'Affiliates', href: '/affiliate-program' }
    ]
  },
  {
    title: 'Features',
    links: [
      { label: 'Network Search', href: '/auth/login' },
      { label: 'Smart Messages', href: '/auth/login' },
      { label: 'WhatsApp Alerts', href: '/auth/login' },
      { label: 'Lead Research', href: '/auth/login' },
      { label: 'Prompt Library', href: '/community' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '#' },
      { label: 'API Reference', href: '#' },
      { label: 'Feedback', href: '#' },
      { label: 'Changelog', href: '#' }
    ]
  },
  {
    title: 'Community',
    links: [
      { label: 'LinkedIn', href: '#' },
      { label: 'Discord', href: '#' }
    ]
  }
]

export function LandingFooter() {
  const { openAuthModal } = useAuthModal()

  return (
    <footer className="relative overflow-hidden bg-[#03060d] px-6 pt-28 pb-16 text-white md:px-12">
      <div className="pointer-events-none absolute inset-x-0 bottom-[-7rem] select-none text-center text-[17vw] font-black leading-none tracking-normal text-white/[0.035]">
        MELRON
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-16 md:grid-cols-[1.2fr_1.8fr]">
        <div>
          <h2 className="font-serif text-5xl tracking-normal">Melron</h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
            Votre assistant carrière intelligent pour trouver les bonnes
            opportunités, contacter les bons profils et activer votre réseau.
          </p>

          <button
            type="button"
            onClick={() => openAuthModal('signup')}
            className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start Building Free
            <span className="flex size-6 items-center justify-center rounded-full bg-black text-white">
              <ArrowRight className="size-3.5" />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {FOOTER_LINKS.map(group => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                {group.title}
              </h3>
              <ul className="mt-6 space-y-4">
                {group.links.map(link => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => {
                        if (link.href === '/auth/login') {
                          openAuthModal('signup')
                        } else {
                          window.location.href = link.href
                        }
                      }}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-20 max-w-7xl border-t border-white/10 pt-8 text-sm text-white/40">
        © 2026 Melron Inc. All rights reserved.
      </div>
    </footer>
  )
}
