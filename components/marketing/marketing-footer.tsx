import Link from 'next/link'

import { Icon } from '@iconify/react'

import { IconLogo } from '@/components/ui/icons'

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <Link href="/" className="flex items-center gap-2">
              <IconLogo className="size-5" />
              <span className="font-semibold text-sm">Morphic</span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-xs text-center md:text-left">
              A fully open-source AI-powered answer engine with a generative UI.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end">
            <Link
              href="/chat"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Try it now
            </Link>
            <Link
              href="https://github.com/miurla/morphic"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon icon="solar:code-bold" className="size-3.5" />
              GitHub
            </Link>
            <Link
              href="https://github.com/miurla/morphic/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon icon="solar:book-2-bold" className="size-3.5" />
              Docs
            </Link>
            <Link
              href="https://github.com/miurla/morphic/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              MIT License
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border/40 pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Morphic. Open-source under the MIT
            License.
          </p>
          <p className="text-xs text-muted-foreground/50">
            Built with Next.js · Vercel AI SDK · Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  )
}
