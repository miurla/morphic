'use client'

import { useRef, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Sparkles } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
// Morphic marketing homepage — "/"
// Signature element: a pointer-tracked 3D glass orb built with pure CSS
// (perspective + rotateX/rotateY), no WebGL/three.js dependency — so it
// can't break the build the way the icon import did last time.
// Uses only shadcn/Tailwind CSS-variable tokens already defined in
// globals.css: bg-background, text-foreground, border-border, bg-primary,
// text-muted-foreground, bg-card. Nothing hardcoded outside those.
// ─────────────────────────────────────────────────────────────────────────

export const metadata_note = null // metadata lives in a separate server file, see README

const capabilities = [
  {
    title: 'Sourced answers',
    description: 'Every claim traces back to a real page you can open and check.'
  },
  {
    title: 'Generative UI',
    description: 'Maps, tables, and images render inline when they explain better than text.'
  },
  {
    title: 'Live web access',
    description: "Answers reflect what's true today, not a frozen training cutoff."
  },
  {
    title: 'Fully open source',
    description: 'Self-host it, fork it, or read exactly how it works — nothing is hidden.'
  }
]

function Hero3D() {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -14, y: px * 18 })
  }

  function handleLeave() {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80"
      style={{ perspective: '900px' }}
    >
      {/* ambient glow beneath the orb */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl"
      />

      {/* the orb itself — layered radial gradients simulate glass + light */}
      <div
        className="relative h-full w-full rounded-full border border-border/60 shadow-2xl transition-transform duration-150 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d',
          background: `
            radial-gradient(circle at 30% 25%, hsl(var(--primary) / 0.55), transparent 45%),
            radial-gradient(circle at 70% 75%, hsl(var(--foreground) / 0.12), transparent 55%),
            hsl(var(--card))
          `,
          boxShadow:
            'inset 0 1px 40px hsl(var(--foreground) / 0.06), inset 0 -20px 60px hsl(var(--background) / 0.4), 0 30px 60px -20px hsl(var(--foreground) / 0.25)'
        }}
      >
        {/* specular highlight */}
        <div
          aria-hidden
          className="absolute left-[18%] top-[14%] h-10 w-16 rounded-full bg-white/40 blur-md sm:h-14 sm:w-20"
        />

        {/* floating search glyph, sits slightly "above" the glass on Z axis */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: 'translateZ(40px)' }}
        >
          <Search
            className="h-14 w-14 text-primary-foreground/90 drop-shadow-lg sm:h-16 sm:w-16"
            strokeWidth={1.5}
          />
        </div>

        {/* thin orbiting ring for depth */}
        <div
          aria-hidden
          className="absolute inset-[-14px] rounded-full border border-primary/25"
          style={{ transform: 'translateZ(-30px) rotateX(70deg)' }}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(var(--primary)/0.10),transparent)]"
        />

        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left: copy */}
          <div className="animate-[fade-in_0.6s_ease-out_forwards] text-center lg:text-left">
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Open source · MIT licensed
            </span>

            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Search that
              <br />
              answers back.
            </h1>

            <p className="mx-auto mt-6 max-w-md text-balance text-base text-muted-foreground sm:text-lg lg:mx-0">
              Morphic reads across the live web and responds with a direct,
              cited answer — open source, self-hostable, free to use.
            </p>

            <form
              action="/search"
              method="get"
              className="mx-auto mt-9 flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-background/80 p-2 shadow-sm backdrop-blur transition-shadow focus-within:shadow-md lg:mx-0"
            >
              <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                name="q"
                type="text"
                placeholder="Ask Morphic anything…"
                autoComplete="off"
                className="h-10 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Search
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* right: 3D orb */}
          <div className="animate-[fade-in_0.8s_ease-out_0.15s_both]">
            <Hero3D />
          </div>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
            {capabilities.map(({ title, description }, i) => (
              <div key={title} className="flex gap-5">
                <span className="pt-1 font-mono text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="border-l border-border pl-5">
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-20 text-center sm:py-28">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ask your first question
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          No account required to try it. Free and open source, always.
        </p>
        <Link
          href="/search"
          className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start searching
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
