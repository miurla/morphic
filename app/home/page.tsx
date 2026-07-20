import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'AI Answer Engine – Ask Anything, Get Cited Answers',
  description:
    'A free, open-source AI-powered answer engine with a generative UI. Ask questions and get grounded, cited answers in seconds.',
  alternates: { canonical: '/home' }
}

export default function HomePage() {
  return (
    <main className="flex flex-col items-center w-full">
      {/* Hero */}
      <section className="w-full max-w-3xl px-4 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Ask anything. Get answers you can trust.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          An open-source AI answer engine that searches the web and gives you
          grounded, source-cited answers with a rich generative interface.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/">Start Searching</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="w-full max-w-4xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-10">
          Why use this answer engine?
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Cited, grounded answers',
              body: 'Every answer is backed by real web sources so you can verify what you read instead of guessing.'
            },
            {
              title: 'Generative UI',
              body: 'Answers render as rich inline components — images, grids and headings — not just plain text.'
            },
            {
              title: 'Fast and free',
              body: 'Get quick or adaptive responses in seconds. No sign-up required to start exploring.'
            }
          ].map(f => (
            <div
              key={f.title}
              className="rounded-lg border bg-card p-6 text-card-foreground"
            >
              <h3 className="font-medium mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="w-full max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-8">How it works</h2>
        <ol className="space-y-6">
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              1
            </span>
            <p className="text-muted-foreground pt-1">
              Type any question into the search box — from quick facts to
              in-depth research topics.
            </p>
          </li>
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              2
            </span>
            <p className="text-muted-foreground pt-1">
              The engine searches the web, reads relevant sources, and composes
              an answer for you.
            </p>
          </li>
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              3
            </span>
            <p className="text-muted-foreground pt-1">
              Read the answer with inline citations, then dig deeper or ask a
              follow-up.
            </p>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <section className="w-full max-w-3xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">Ready to try it?</h2>
        <p className="text-muted-foreground mb-6">
          Jump in and ask your first question — it&apos;s completely free.
        </p>
        <Button asChild size="lg">
          <Link href="/">Open the Answer Engine</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="w-full border-t py-8 text-center text-sm text-muted-foreground">
        <nav className="flex flex-wrap justify-center gap-4 mb-3">
          <Link href="/home" className="hover:underline">Home</Link>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
        </nav>
        <p>© {new Date().getFullYear()} Your Site Name. All rights reserved.</p>
      </footer>
    </main>
  )
}
