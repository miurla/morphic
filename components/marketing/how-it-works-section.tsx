import { Icon } from '@iconify/react'

const steps = [
  {
    number: '01',
    icon: 'solar:chat-round-bold',
    title: 'Ask any question',
    description:
      'Type your question naturally — Morphic understands context, follow-ups, and complex multi-part queries.',
  },
  {
    number: '02',
    icon: 'solar:magnifer-bold',
    title: 'AI searches the web',
    description:
      'Morphic dispatches live web searches, evaluates source quality, and synthesizes the most relevant information in real time.',
  },
  {
    number: '03',
    icon: 'solar:document-text-bold',
    title: 'Get a structured answer',
    description:
      'Receive a clear, cited response with inline sources, related images, follow-up questions, and a full research trail.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From question to answer in seconds.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            No hallucinations, no guesswork. Every answer is traceable back to
            real sources on the live web.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line — desktop only */}
          <div className="absolute top-12 left-0 right-0 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />

          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                {/* Step indicator */}
                <div className="relative mb-6 flex size-24 items-center justify-center">
                  {/* Glassmorphism ring */}
                  <div className="absolute inset-0 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm" />
                  {/* Number badge */}
                  <div className="absolute -top-1 -right-1 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <Icon icon={step.icon} className="relative z-10 size-8 text-foreground/70" />
                </div>

                <span className="mb-1 text-xs font-semibold tabular-nums text-muted-foreground/60">
                  STEP {step.number}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
