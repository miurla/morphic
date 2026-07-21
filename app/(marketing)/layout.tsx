import Link from 'next/link'
import {
  Search,
  Globe2,
  Layers,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
// Morphic marketing homepage — lives at "/"
//
// This page intentionally shares the same design tokens as the chat/search
// route (bg-background, text-foreground, border-border, bg-primary, etc.)
// which are defined once in globals.css and consumed via tailwind.config.ts.
// That's what keeps this page from feeling "bolted on" next to /search —
// it's the same CSS variables, just arranged as a landing page instead of
// a chat surface.
//
// Drop this file at: app/(marketing)/page.tsx
// and move your existing chat/search page to: app/search/page.tsx
// (or wherever your chat route already lives — see the README notes
// at the bottom of this file for wiring instructions).
// ─────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Morphic — The open-source AI search engine',
  description:
    'Morphic pairs a fast, generative search experience with sourced answers and a fully open-source codebase. Ask anything, get answers with citations, and see the sources for yourself.'
}

const features = [
  {
    icon: Search,
    title: 'Answers with sources',
    description:
      'Every response is grounded in live search results, with citations you can click through and verify yourself.'
  },
  {
    icon: Layers,
    title: 'Generative UI',
    description:
      'Results render as interactive cards, not just text — maps, images, and structured data appear inline as they help.'
  },
  {
    icon: Globe2,
    title: 'Real-time web access',
    description:
      'Morphic searches the live web for every query, so answers reflect what is true right now, not a fixed training cutoff.'
  },
  {
    icon: ShieldCheck,
    title: 'Open source, end to end',
    description:
      'The full codebase is public. Inspect it, self-host it, or contribute — nothing about how Morphic works is hidden.'
  }
]

const steps = [
  {
    label: '01',
    title: 'Ask a question',
    description: 'Type anything — a question, a topic, a half-formed idea. Morphic works from natural language, not keywords.'
  },
  {
    label: '02',
    title: 'Morphic searches and reads',
    description: 'It queries the web in real time and reads through multiple sources before responding.'
  },
  {
    label: '03',
    title: 'Get a sourced answer',
    description: 'You get a direct answer with inline citations, follow-up suggestions, and the option to dig deeper.'
  }
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]"
        />

        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Open source · MIT licensed
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Search, answered.
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          Morphic is an AI search engine that reads the web for you and
          answers with real sources — open source, and free to self-host.
        </p>

        {/* Signature element: this pill is the same shape, radius, and
            focus-ring treatment as the real chat input on /search, so the
            homepage visually "morphs" into the chat route on submit. */}
        <form
          action="/search"
          method="get"
          className="mt-10 flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-background/80 p-2 shadow-sm backdrop-blur transition-shadow focus-within:shadow-md"
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

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Try:</span>
          {['What changed in the latest Next.js release?', 'Compare EVs under $40k', 'Explain quantum entanglement simply'].map(
            example => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}`}
                className="rounded-full border border-border px-3 py-1 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {example}
              </Link>
            )
          )}
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Built to be transparent
            </h2>
            <p className="mt-3 text-muted-foreground">
              No black box. Every answer traces back to a source, and every
              line of code is public.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
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

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How it works
          </h2>

          <ol className="mt-14 space-y-10">
            {steps.map(({ label, title, description }) => (
              <li key={label} className="flex gap-5">
                <span className="font-mono text-sm text-muted-foreground/70">
                  {label}
                </span>
                <div className="border-l border-border pl-5">
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
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
