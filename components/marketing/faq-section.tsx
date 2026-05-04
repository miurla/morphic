'use client'

import { useState } from 'react'

import { Icon } from '@iconify/react'

import { cn } from '@/lib/utils'

const faqs = [
  {
    q: 'Is Morphic free to use?',
    a: 'Morphic is open-source and free to self-host. You only pay for the API keys of the AI providers you choose (OpenAI, Anthropic, Google, etc.). The Morphic cloud deployment may have its own pricing tier.',
  },
  {
    q: 'What AI models are supported?',
    a: 'Morphic supports OpenAI (GPT-4o, o-series), Anthropic (Claude), Google (Gemini), and more. You can configure any combination and switch between them per-session. See the models.json config for the full list.',
  },
  {
    q: 'Can I self-host Morphic?',
    a: 'Yes. Morphic ships with a Docker Compose setup that includes the app, PostgreSQL, Redis, and SearXNG for self-hosted search. Run docker compose up -d and you\'re live in minutes.',
  },
  {
    q: 'Is my data private?',
    a: 'When self-hosted, your data stays entirely on your infrastructure. Chat history is stored in your PostgreSQL database. Morphic never sends your conversations to any external service beyond the AI provider you configure.',
  },
  {
    q: 'How does Morphic compare to ChatGPT or Perplexity?',
    a: 'Morphic is fully open-source and self-hostable, unlike both. It focuses on transparent, cited answers with a generative UI — you can see exactly which sources informed each answer, and you\'re not locked into a single AI provider.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="relative px-6 py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-muted/20" />

      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Common questions.
          </h2>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                className={cn(
                  'rounded-xl border transition-all',
                  isOpen
                    ? 'border-border bg-card shadow-sm'
                    : 'border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/60'
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-foreground text-sm leading-snug">
                    {faq.q}
                  </span>
                  <Icon
                    icon={
                      isOpen
                        ? 'solar:alt-arrow-up-bold'
                        : 'solar:alt-arrow-down-bold'
                    }
                    className="size-4 shrink-0 text-muted-foreground transition-transform"
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
