import { Icon } from '@iconify/react'

const features = [
  {
    icon: 'solar:magnifer-bold',
    title: 'Real-time Web Search',
    description:
      'Every answer is grounded in live search results. Morphic queries the web at the moment you ask, not from a stale training snapshot.',
  },
  {
    icon: 'solar:magic-stick-bold',
    title: 'Generative UI',
    description:
      "Answers aren't walls of text. Morphic renders structured responses — with sources, follow-up questions, and rich components — in real time.",
  },
  {
    icon: 'solar:layers-bold',
    title: 'Multiple AI Providers',
    description:
      'Switch between OpenAI, Anthropic, Google, and more. Bring your own API keys and stay in control of which models power your searches.',
  },
  {
    icon: 'solar:code-bold',
    title: 'Fully Open Source',
    description:
      'Every line is on GitHub under the MIT license. Self-host it in minutes with Docker, or deploy to Vercel with a single click.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 py-24">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-muted/20" />
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Capabilities
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for answers, not just chat.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Morphic combines a powerful search engine with a generative UI framework
            to give you answers you can actually trust and trace.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(f => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-border hover:bg-card hover:shadow-md"
            >
              {/* Icon */}
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
                <Icon icon={f.icon} className="size-5 text-foreground/70" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
