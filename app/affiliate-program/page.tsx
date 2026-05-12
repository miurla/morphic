import Link from 'next/link'

import { ArrowRight, BadgeDollarSign, Check, Clock, Users } from 'lucide-react'

import { AffiliateEarningsCalculator } from '@/components/landing/affiliate-earnings-calculator'
import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'

const STEPS = [
  {
    title: 'Apply',
    description: 'Create your affiliate account and get your unique link.'
  },
  {
    title: 'Share',
    description: 'Share Melron with your audience, clients or community.'
  },
  {
    title: 'Earn',
    description: 'Receive 20% recurring commission for every paid customer.'
  }
]

const BENEFITS = [
  '20% recurring commission',
  'Long attribution window',
  'High-converting landing pages',
  'Ready-to-use copy and creatives',
  'Transparent payout tracking',
  'Built for creators, operators and consultants'
]

const FAQS = [
  {
    question: 'Who can join?',
    answer:
      'Creators, consultants, agencies, recruiters and operators with an audience that cares about networking, sales, hiring or career growth.'
  },
  {
    question: 'How much can I earn?',
    answer:
      'You earn 20% of every referred subscription for as long as that customer remains active.'
  },
  {
    question: 'When are payouts sent?',
    answer:
      'Approved commissions are reviewed monthly and paid after the standard refund and fraud review period.'
  }
]

export default function AffiliateProgramPage() {
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
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
                <BadgeDollarSign className="size-4 text-foreground" />
                Melron Affiliate Program
              </div>

              <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                Earn 20% recurring.{' '}
                <span className="italic text-muted-foreground">Forever</span>.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Share Melron with people who want to activate their network and
                earn recurring commission every time they become customers.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/auth/login?next=/affiliate-program"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Start earning
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="#calculator"
                  className="inline-flex rounded-full border bg-white px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Calculate earnings
                </Link>
              </div>
            </div>

            <div className="mt-14 grid w-full max-w-5xl gap-4 md:grid-cols-3">
              <div className="rounded-3xl border bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                <p className="text-4xl font-bold">20%</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  recurring commission
                </p>
              </div>
              <div className="rounded-3xl border bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                <p className="text-4xl font-bold">12mo</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  attribution window
                </p>
              </div>
              <div className="rounded-3xl border bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                <p className="text-4xl font-bold">$25+</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  monthly plans to promote
                </p>
              </div>
            </div>
          </section>

          <section
            id="calculator"
            className="relative z-10 mx-auto max-w-7xl px-6 pb-24 md:px-12"
          >
            <AffiliateEarningsCalculator />
          </section>

          <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 pb-24 md:grid-cols-3 md:px-12">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border bg-white p-7 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                  {index + 1}
                </div>
                <h2 className="mt-6 text-2xl font-bold">{step.title}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </section>

          <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 pb-24 md:grid-cols-[0.9fr_1.1fr] md:px-12">
            <div>
              <h2 className="font-serif text-4xl font-semibold md:text-5xl">
                Why join?
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                Melron is useful for founders, recruiters, sales teams,
                consultants and job seekers. That makes it easy to recommend
                naturally.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map(benefit => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <Check className="size-5 shrink-0" />
                  <span className="font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-6 pb-24 md:grid-cols-3 md:px-12">
            <div className="rounded-3xl border bg-white p-7 shadow-sm">
              <Users className="size-8" />
              <h3 className="mt-5 text-xl font-bold">Audience fit</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Promote to people who already use LinkedIn, email and
                relationship-driven workflows.
              </p>
            </div>
            <div className="rounded-3xl border bg-white p-7 shadow-sm">
              <Clock className="size-8" />
              <h3 className="mt-5 text-xl font-bold">Recurring value</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                You earn as long as your referrals keep using Melron.
              </p>
            </div>
            <div className="rounded-3xl border bg-white p-7 shadow-sm">
              <BadgeDollarSign className="size-8" />
              <h3 className="mt-5 text-xl font-bold">Simple payouts</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Track signups, subscriptions and commissions from one place.
              </p>
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-4xl px-6 pb-28 md:px-12">
            <h2 className="text-center font-serif text-4xl font-semibold md:text-5xl">
              Questions
            </h2>
            <div className="mt-10 divide-y rounded-3xl border bg-white shadow-sm">
              {FAQS.map(item => (
                <div key={item.question} className="p-6">
                  <h3 className="text-lg font-bold">{item.question}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
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
