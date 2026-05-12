import Link from 'next/link'

import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  MessageSquareText,
  Network,
  Search,
  Sparkles
} from 'lucide-react'

import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'

const CAPABILITIES = [
  {
    title: 'Find people in your network',
    description:
      'Search LinkedIn relationships by role, company, location, industry and intent signals.',
    Icon: Network
  },
  {
    title: 'Spot job and opportunity signals',
    description:
      'Surface hiring plans, recent changes, active openings and warm paths before they become obvious.',
    Icon: BriefcaseBusiness
  },
  {
    title: 'Write smarter outreach',
    description:
      'Generate short, contextual messages based on the person, signal and next action.',
    Icon: MessageSquareText
  },
  {
    title: 'Turn searches into alerts',
    description:
      'Create recurring workflows and WhatsApp notifications for the moments worth acting on.',
    Icon: Bell
  }
]

const WORKFLOWS = [
  'Find relevant people from your LinkedIn network',
  'Research opportunities connected to your background',
  'Draft personalized messages without generic intros',
  'Track active searches, follow-ups and next steps'
]

export default function AboutMelronPage() {
  return (
    <div
      className="h-dvh w-full overflow-y-auto bg-white text-black"
      style={landingLightTheme}
    >
      <main className="relative bg-white">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[#03060d]" />
        <div className="relative z-10 overflow-hidden rounded-b-[4.5rem] bg-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <div className="absolute inset-0 [background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="pointer-events-none absolute inset-0 bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_18%,black)]" />
          <LandingNavbar />

          <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 pt-36 pb-20 md:grid-cols-[0.95fr_1.05fr] md:px-12">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Sparkles className="size-4 text-foreground" />
                Melron AI networker
              </div>
              <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                Activate the network you already have.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Melron helps professionals find hidden opportunities, identify
                the right people, and write timely messages from real network
                signals.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Try Melron
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/community"
                  className="inline-flex items-center justify-center gap-2 rounded-full border bg-white px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Browse prompts
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur"
                >
                  <Icon className="size-7" />
                  <h2 className="mt-5 text-lg font-bold leading-tight">
                    {title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 pb-28 md:grid-cols-[0.9fr_1.1fr] md:px-12">
            <div>
              <h2 className="font-serif text-4xl font-semibold md:text-5xl">
                Built for repeated relationship work.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Melron combines chat, search, MCP tools, rich result cards and
                reusable prompt templates so networking becomes an operating
                system, not a one-off search.
              </p>
            </div>
            <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                  <Search className="size-5" />
                </div>
                <h3 className="text-xl font-bold">Core workflows</h3>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {WORKFLOWS.map(workflow => (
                  <li key={workflow} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0" />
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {workflow}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>

      <div className="bg-[#03060d]">
        <LandingFooter />
      </div>
    </div>
  )
}
