import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { BLOG_POSTS } from '@/components/landing/blog-data'
import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'

const CONTENT = [
  {
    id: 'problem',
    title: 'Why the old workflow breaks down',
    body: [
      'Most professionals already have enough contacts, notes and past conversations. The hard part is knowing who to contact, why now and what to say.',
      'A strong workflow combines context, timing and a clear next action. That is where Melron helps turn network signals into useful opportunities.'
    ]
  },
  {
    id: 'signals',
    title: 'Start from signals, not lists',
    body: [
      'A list gives you names. A signal gives you timing. Job changes, recent posts, hiring plans, fundraising activity and public questions can all change the quality of an outreach message.',
      'When your message references the right signal, it feels relevant instead of generic.'
    ]
  },
  {
    id: 'message',
    title: 'Write for a quick response',
    body: [
      'The best messages are short, specific and easy to answer. They show that you understand the recipient without turning the first touch into a pitch.',
      'A good opening explains why this person, why now and what small next step makes sense.'
    ]
  },
  {
    id: 'system',
    title: 'Turn it into a repeatable system',
    body: [
      'Once the workflow works once, save it as a repeatable prompt or template. That gives you speed without losing personalization.',
      'Review results weekly: who replied, which signals worked and which messages created the best conversations.'
    ]
  }
]

const CHECKLIST = [
  'Identify the exact person and context',
  'Use a recent signal to explain timing',
  'Keep the first message short',
  'Ask for one clear next step',
  'Save the workflow as a reusable template'
]

export function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }))
}

export default async function BlogDetailPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = BLOG_POSTS.find(item => item.slug === slug)

  if (!post) {
    notFound()
  }

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

          <article className="relative z-10 mx-auto max-w-7xl px-6 pt-36 pb-24 md:px-12">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to blog
            </Link>

            <header className="mt-10 max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {post.category} · {post.date} · {post.readTime}
              </p>
              <h1 className="mt-6 font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                {post.title}
              </h1>
              <p className="mt-6 max-w-3xl text-xl leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
              <p className="mt-8 text-sm font-semibold text-foreground">
                By {post.author}
              </p>
            </header>

            <div className="mt-12 h-[360px] rounded-[2rem] border bg-[radial-gradient(circle_at_70%_25%,#facc15_0_18%,transparent_35%),radial-gradient(circle_at_28%_68%,#2563eb_0_18%,transparent_35%),linear-gradient(135deg,#a7f3d0,#f9a8d4)] shadow-xl" />

            <div className="mt-16 grid gap-12 lg:grid-cols-[260px_1fr]">
              <aside className="hidden lg:block">
                <div className="sticky top-24 rounded-3xl border bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    On this page
                  </p>
                  <nav className="mt-5 space-y-3">
                    {CONTENT.map(section => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {section.title}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>

              <div className="max-w-3xl">
                <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
                  <h2 className="text-2xl font-bold">
                    The practical checklist
                  </h2>
                  <ul className="mt-6 space-y-4">
                    {CHECKLIST.map(item => (
                      <li key={item} className="flex gap-3">
                        <Check className="mt-0.5 size-5 shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-12 space-y-14">
                  {CONTENT.map(section => (
                    <section key={section.id} id={section.id}>
                      <h2 className="text-3xl font-bold tracking-tight">
                        {section.title}
                      </h2>
                      <div className="mt-5 space-y-5 text-lg leading-relaxed text-muted-foreground">
                        {section.body.map(paragraph => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="mt-16 rounded-[2rem] bg-foreground p-8 text-background">
                  <h2 className="text-3xl font-bold">
                    Build better network workflows with Melron.
                  </h2>
                  <p className="mt-4 max-w-xl text-background/70">
                    Use templates, smart messages and network search to turn
                    your relationships into concrete opportunities.
                  </p>
                  <Link
                    href="/auth/login"
                    className="mt-7 inline-flex items-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground"
                  >
                    Start building
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      <div className="bg-[#03060d]">
        <LandingFooter />
      </div>
    </div>
  )
}
