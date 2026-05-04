import Link from 'next/link'

import { Icon } from '@iconify/react'

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-16">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[600px] w-[600px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[800px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          <Icon icon="solar:code-bold" className="size-3" />
          Fully open-source
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />
          MIT License
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          The AI answer engine
          <br />
          <span className="text-foreground/50">that shows its work.</span>
        </h1>

        {/* Subline */}
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Morphic searches the web in real time, reasons through results, and
          delivers structured answers with cited sources — powered by the AI
          model you choose.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/chat"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all hover:shadow-lg"
          >
            Start searching
            <Icon
              icon="solar:alt-arrow-right-bold"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="https://github.com/miurla/morphic"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card/60 px-6 py-3 text-base font-medium text-foreground/80 hover:bg-accent backdrop-blur-sm transition-colors"
          >
            <Icon icon="solar:code-bold" className="size-4" />
            View on GitHub
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-xs text-muted-foreground/60">
          Open-source · Self-hostable · No vendor lock-in
        </p>

        {/* Glassmorphism preview card */}
        <div className="mt-16 mx-auto max-w-2xl">
          <div className="relative rounded-2xl border border-border/50 bg-card/50 p-1 backdrop-blur-sm shadow-xl">
            <div className="rounded-xl bg-muted/30 p-6 text-left">
              {/* Fake search bar */}
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                <Icon
                  icon="solar:magnifer-bold"
                  className="size-4 shrink-0 text-muted-foreground/60"
                />
                <span className="truncate">
                  How does quantum entanglement work?
                </span>
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  <div className="size-2 rounded-full bg-primary/60 animate-pulse" />
                </div>
              </div>
              {/* Fake answer preview */}
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <div className="mt-1 size-3 shrink-0 rounded-full bg-primary/20" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 rounded-full bg-foreground/10 w-full" />
                    <div className="h-2.5 rounded-full bg-foreground/10 w-4/5" />
                    <div className="h-2.5 rounded-full bg-foreground/10 w-3/5" />
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  {['arxiv.org', 'nature.com', 'phys.org'].map(s => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground/70"
                    >
                      <Icon icon="solar:link-bold" className="size-2.5" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
