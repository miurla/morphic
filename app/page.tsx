'use client'

import { useRef, useState, useEffect, type MouseEvent } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowRight,
  Sparkles,
  Globe,
  ShieldCheck,
  Cpu,
  Zap,
  Terminal,
  Layers,
  ChevronDown,
  ExternalLink
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
// Morphic AI Enterprise Marketing Homepage
// Features: Sticky Glass Nav, Pointer-tracked 3D Glass Orb, Marquee Ticker,
// Architecture Overview, and Production-Grade Enterprise Footer.
// ─────────────────────────────────────────────────────────────────────────

export const metadata_note = null

const capabilities = [
  {
    icon: Globe,
    title: 'Real-Time Web Indexing',
    description:
      'Queries are executed against live web endpoints in real time, eliminating training cutoff limitations.'
  },
  {
    icon: ShieldCheck,
    title: 'Verifiable Citations',
    description:
      'Every synthesized response provides inline structural links directly back to primary source documentation.'
  },
  {
    icon: Layers,
    title: 'Dynamic Generative UI',
    description:
      'Automatically renders interactive data tables, code snippets, and rich media widgets based on user intent.'
  },
  {
    icon: Terminal,
    title: 'Fully Open Source',
    description:
      'Complete transparency. Deploy natively on your own infrastructure with zero third-party telemetry.'
  }
]

const architectureSteps = [
  {
    step: '01',
    name: 'Intent Parsing & Retrieval',
    detail: 'Deconstructs user queries and searches parallel deep-web indexes using multi-model routing.'
  },
  {
    step: '02',
    name: 'Synthesis & Fact Verification',
    detail: 'Cross-references content across trusted endpoints to filter misinformation and build provenance.'
  },
  {
    step: '03',
    name: 'Generative Interface Rendering',
    detail: 'Streams structured Markdown and context-aware dynamic React components directly to the client.'
  }
]

const tickerItems = [
  'Real-Time Web Search',
  'Verifiable Provenance',
  'Self-Hostable Architecture',
  'Generative UI Components',
  'MIT Licensed',
  'Zero Data Retention'
]

// Custom Morphic Brand Logo
function MorphicLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="100" cy="100" r="100" className="fill-foreground" />
      <circle cx="75" cy="100" r="14" className="fill-background" />
      <circle cx="125" cy="100" r="14" className="fill-background" />
    </svg>
  )
}

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
      className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96"
      style={{ perspective: '1000px' }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl opacity-70"
      />

      {/* Glass Orb Shell */}
      <div
        className="relative h-full w-full rounded-full border border-border/80 shadow-2xl transition-transform duration-200 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d',
          background: `
            radial-gradient(circle at 30% 25%, hsl(var(--primary) / 0.5), transparent 45%),
            radial-gradient(circle at 70% 75%, hsl(var(--foreground) / 0.1), transparent 55%),
            hsl(var(--card))
          `,
          boxShadow:
            'inset 0 1px 40px hsl(var(--foreground) / 0.08), inset 0 -20px 60px hsl(var(--background) / 0.5), 0 30px 60px -20px hsl(var(--foreground) / 0.3)'
        }}
      >
        {/* Specular Highlight */}
        <div
          aria-hidden
          className="absolute left-[18%] top-[14%] h-12 w-20 rounded-full bg-white/35 blur-md"
        />

        {/* Morphic Logo Centerpiece */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: 'translateZ(45px)' }}
        >
          <MorphicLogo className="h-20 w-20 drop-shadow-2xl sm:h-24 sm:w-24" />
        </div>

        {/* Orbit Ring */}
        <div
          aria-hidden
          className="absolute inset-[-16px] rounded-full border border-primary/30"
          style={{ transform: 'translateZ(-35px) rotateX(70deg)' }}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground scroll-smooth antialiased">
      {/* ── Sticky Header Navigation ──────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all duration-200 ${
          scrolled
            ? 'border-border/80 bg-background/80 backdrop-blur-md py-3 shadow-sm'
            : 'border-transparent bg-transparent py-5'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <MorphicLogo className="h-7 w-7 transition-transform group-hover:scale-105" />
            <span className="text-lg font-semibold tracking-tight">Morphic</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground border border-border">
              v1.0
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#capabilities" className="transition-colors hover:text-foreground">
              Capabilities
            </a>
            <a href="#architecture" className="transition-colors hover:text-foreground">
              Architecture
            </a>
            <a
              href="https://github.com/Siddhant-33/morphic.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              Source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Launch App
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-6 pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
          />

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Copy Column */}
            <div className="text-center lg:col-span-7 lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Autonomous Web Intelligence</span>
              </div>

              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl lg:leading-[1.08]">
                Search Engineered for Absolute Clarity.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                Morphic synthesizes live web data into grounded, verifiable answers. 
                Complete with inline primary source citations and dynamic generative UI components.
              </p>

              {/* Search Box Form */}
              <form
                action="/search"
                method="get"
                className="mx-auto mt-8 flex w-full max-w-lg items-center gap-2 rounded-full border border-border bg-card/90 p-2 shadow-md backdrop-blur transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 lg:mx-0"
              >
                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  name="q"
                  type="text"
                  placeholder="Ask a question or enter a topic..."
                  autoComplete="off"
                  className="h-10 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>Search</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              {/* Quick Metrics */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border/60 pt-6 text-left">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Latency</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">&lt; 1.2s Realtime</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">License</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">100% Open Source</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Privacy</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">Zero Retention</dd>
                </div>
              </div>
            </div>

            {/* Right 3D Orb Display */}
            <div className="flex justify-center lg:col-span-5">
              <Hero3D />
            </div>
          </div>

          {/* Scroll Down Visual Prompt */}
          <div className="mt-16 flex justify-center">
            <a
              href="#ticker"
              aria-label="Scroll down to features"
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <span>Explore Architecture</span>
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </a>
          </div>
        </section>

        {/* ── Marquee Feature Strip ────────────────────────────────────── */}
        <section id="ticker" className="border-y border-border bg-muted/30 py-4 overflow-hidden">
          <div className="flex w-max animate-[marquee_25s_linear_infinite] gap-12 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <Zap className="h-3 w-3 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Capabilities Grid Section ────────────────────────────────── */}
        <section id="capabilities" className="px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                System Core Features
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built for clarity, speed, and absolute technical transparency.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div>
                    <div className="inline-flex rounded-lg border border-border bg-muted p-2.5 text-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Architecture Workflow Section ────────────────────────────── */}
        <section id="architecture" className="border-t border-border bg-card/40 px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                  Execution Pipeline
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  How Morphic processes intent.
                </p>
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                An end-to-end multi-agent pipeline designed to extract real-time web insights without hallucination.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
              {architectureSteps.map(({ step, name, detail }) => (
                <div
                  key={step}
                  className="relative flex flex-col justify-between rounded-xl border border-border bg-background p-8"
                >
                  <div>
                    <span className="font-mono text-2xl font-bold text-primary/80">{step}</span>
                    <h3 className="mt-4 font-semibold text-foreground">{name}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Formal CTA Section ───────────────────────────────────────── */}
        <section className="border-t border-border px-6 py-24 text-center sm:py-32">
          <div className="mx-auto max-w-3xl">
            <Cpu className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Start querying the web directly.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Experience transparent, cited search interfaces with zero authentication required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                <span>Launch Search Engine</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Enterprise Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
            {/* Column 1: Brand Info */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2">
                <MorphicLogo className="h-6 w-6" />
                <span className="font-semibold tracking-tight">Morphic AI</span>
              </Link>
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">
                An open-source generative search engine providing real-time, sourced web intelligence.
              </p>
            </div>

            {/* Column 2: Navigation */}
            <div>
              <h4 className="text-xs font-semibold text-foreground">Product</h4>
              <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                <li>
                  <Link href="/search" className="transition-colors hover:text-foreground">
                    Search App
                  </Link>
                </li>
                <li>
                  <a href="#capabilities" className="transition-colors hover:text-foreground">
                    Capabilities
                  </a>
                </li>
                <li>
                  <a href="#architecture" className="transition-colors hover:text-foreground">
                    Architecture
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Developer Resources */}
            <div>
              <h4 className="text-xs font-semibold text-foreground">Resources</h4>
              <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                <li>
                  <a
                    href="https://github.com/Siddhant-33/morphic.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-foreground">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div>
              <h4 className="text-xs font-semibold text-foreground">Legal & Privacy</h4>
              <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                <li>
                  <Link href="/privacy" className="transition-colors hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition-colors hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
            <p>Made by Siddhant Ray</p>
            <p>© {new Date().getFullYear()} Morphic AI. Open Source under MIT License.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
