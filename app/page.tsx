import Link from 'next/link'
import { Github } from 'lucide-react'

// Layout wrapping the homepage + /about + /terms + /privacy.
// Reuses bg-background / text-foreground / border-border so header and
// footer are pixel-for-pixel consistent with the chat route's shell.
// If your project already has a global header in app/layout.tsx, delete
// the <header> block below to avoid a duplicate nav bar.

export default function MarketingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <span className="inline-block h-5 w-5 rounded-full bg-foreground" aria-hidden />
            Morphic
          </Link>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link
              href="https://github.com/Siddhant-33/MorphicAi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
            <Link
              href="/search"
              className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open chat
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Morphic. Open source under the MIT License.</p>
          <div className="flex items-center gap-5">
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link
              href="https://github.com/Siddhant-33/MorphicAi"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
