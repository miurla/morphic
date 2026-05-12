'use client'

import { useState } from 'react'
import Link from 'next/link'

import { ArrowRight, ChevronDown } from 'lucide-react'

import { IconLogo } from '@/components/ui/icons'

const TOOLS = [
  {
    name: 'Talk with your network',
    description: "Échange avec tes contacts LinkedIn via l'IA"
  },
  {
    name: 'Prospection LinkedIn',
    description: 'Trouve et contacte les bons profils'
  },
  {
    name: "Recherche d'opportunités",
    description: 'Découvre les offres qui matchent ton profil'
  },
  {
    name: 'Alertes WhatsApp',
    description: 'Reçois tes résultats en temps réel'
  },
  {
    name: 'Smart Message',
    description: "Génère des messages personnalisés par l'IA"
  },
  {
    name: 'Schedule Message',
    description: "Programme l'envoi de tes messages"
  }
]

function ToolsDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        Tools
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-2">
          <div className="grid w-[420px] grid-cols-2 gap-1 rounded-xl border bg-background p-3 shadow-lg">
            {TOOLS.map(tool => (
              <Link
                key={tool.name}
                href="/auth/login"
                className="rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <p className="text-sm font-medium text-foreground">
                  {tool.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function LandingNavbar() {
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
            <ToolsDropdown />
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
          <Link
            href="/auth/login"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            My Network
          </Link>
          <Link
            href="/pricing"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get Premium
          </Link>
          <Link
            href="/auth/login"
            className="rounded-full border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
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

          <a
            href="/auth/login"
            className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start Building Free
            <span className="flex size-6 items-center justify-center rounded-full bg-black text-white">
              <ArrowRight className="size-3.5" />
            </span>
          </a>
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
                    <a
                      href={link.href}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
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
