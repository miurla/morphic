import Link from 'next/link'

import { ArrowRight, Check, Sparkles } from 'lucide-react'

import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'
import { PricingCreditSelect } from '@/components/landing/pricing-credit-select'

const PREMIUM_FEATURES = [
  '100 monthly credits',
  'Credit rollovers',
  'Advanced LinkedIn network search',
  'Unlimited smart messages',
  'WhatsApp opportunity alerts',
  'Premium prompt templates',
  'Saved searches and chat history',
  'Priority support'
]

export default function PricingPage() {
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

          <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center px-6 pt-40 pb-24 md:px-12">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Sparkles className="size-4 text-foreground" />
                Melron Premium
              </div>

              <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                Network like a{' '}
                <span className="italic text-muted-foreground">pro</span>.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Débloquez les recherches avancées, les messages intelligents et
                les alertes qui transforment votre réseau en opportunités.
              </p>
            </div>

            <div className="mt-10 inline-flex rounded-full border bg-muted p-1 shadow-sm">
              <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-foreground shadow-sm">
                Monthly
              </button>
              <button className="rounded-full px-5 py-2 text-sm font-semibold text-muted-foreground">
                Yearly
              </button>
            </div>

            <div className="mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1.08fr_1fr]">
              <div className="rounded-3xl border bg-white/70 p-8 shadow-sm backdrop-blur">
                <h2 className="text-lg font-bold">Free</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Pour découvrir Melron et lancer vos premières actions réseau.
                </p>
                <p className="mt-8 text-4xl font-bold">$0</p>
                <p className="mt-1 text-sm text-muted-foreground">per month</p>
                <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <Check className="mt-0.5 size-4 text-foreground" />
                    Recherches limitées
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 size-4 text-foreground" />
                    Prompts communautaires
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 size-4 text-foreground" />
                    Messages de base
                  </li>
                </ul>
              </div>

              <div className="relative rounded-[2rem] border-2 border-foreground bg-white p-8 shadow-2xl">
                <div className="absolute right-6 top-6 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                  Most popular
                </div>

                <h2 className="text-xl font-bold">Pro</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Designed for fast-moving professionals building relationships
                  in real time.
                </p>

                <div className="mt-8 flex items-end gap-2">
                  <span className="text-6xl font-bold tracking-tight">$25</span>
                  <span className="pb-2 text-sm font-medium text-muted-foreground">
                    per month
                  </span>
                </div>

                <Link
                  href="/auth/login?plan=pro"
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-md transition-opacity hover:opacity-90"
                >
                  Sign in to subscribe
                  <ArrowRight className="size-4" />
                </Link>

                <div className="mt-6">
                  <PricingCreditSelect />
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-foreground">
                    All features in Free, plus:
                  </h3>
                  <ul className="mt-5 space-y-4">
                    {PREMIUM_FEATURES.map(feature => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm leading-relaxed text-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-3xl border bg-white/70 p-8 shadow-sm backdrop-blur">
                <h2 className="text-lg font-bold">Team</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Pour les équipes sales, recrutement ou partnerships qui
                  veulent industrialiser leur réseau.
                </p>
                <p className="mt-8 text-4xl font-bold">Custom</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  annual billing
                </p>
                <Link
                  href="/auth/login?plan=team"
                  className="mt-8 inline-flex rounded-full border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Contact us
                </Link>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-muted-foreground">
              Need something custom? Contact us for enterprise workflows and
              team rollout.
            </p>
          </section>
        </div>
      </main>
      <div className="bg-[#03060d]">
        <LandingFooter />
      </div>
    </div>
  )
}
