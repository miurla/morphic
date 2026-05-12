import Link from 'next/link'

import { ArrowRight } from 'lucide-react'

import { BLOG_CATEGORIES, BLOG_POSTS } from '@/components/landing/blog-data'
import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'

function BlogCover({ index }: { index: number }) {
  const gradients = [
    'radial-gradient(circle at 72% 28%, #fb7185 0 18%, transparent 34%), radial-gradient(circle at 28% 68%, #2563eb 0 18%, transparent 35%), linear-gradient(135deg, #a7f3d0, #f9a8d4)',
    'radial-gradient(circle at 70% 25%, #facc15 0 18%, transparent 35%), radial-gradient(circle at 28% 68%, #0f766e 0 18%, transparent 35%), linear-gradient(135deg, #93c5fd, #f0abfc)',
    'radial-gradient(circle at 72% 28%, #8df6c8 0 16%, transparent 34%), radial-gradient(circle at 30% 70%, #283c86 0 18%, transparent 35%), linear-gradient(135deg, #f2d184, #dc79cf 74%)',
    'radial-gradient(circle at 65% 28%, #ff8e72 0 17%, transparent 35%), radial-gradient(circle at 28% 64%, #23b7a7 0 18%, transparent 36%), linear-gradient(135deg, #7da8ff, #f6a3d1)',
    'radial-gradient(circle at 72% 30%, #ffe66d 0 16%, transparent 35%), radial-gradient(circle at 27% 66%, #7137c8 0 18%, transparent 34%), linear-gradient(135deg, #7fe0de, #ffa0b8)',
    'radial-gradient(circle at 70% 24%, #fde047 0 17%, transparent 35%), radial-gradient(circle at 28% 66%, #1d4ed8 0 18%, transparent 35%), linear-gradient(135deg, #c4b5fd, #fb7185)'
  ]

  return (
    <div
      className="h-56 rounded-2xl border"
      style={{ backgroundImage: gradients[index % gradients.length] }}
    />
  )
}

export default function BlogPage() {
  const featured = BLOG_POSTS[0]
  const posts = BLOG_POSTS.slice(1)

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

          <section className="relative z-10 mx-auto max-w-7xl px-6 pt-40 pb-24 md:px-12">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                The Melron{' '}
                <span className="italic text-muted-foreground">Blog</span>.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Guides, comparisons and workflows for activating your network,
                writing better messages and finding hidden opportunities.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {BLOG_CATEGORIES.map(category => (
                <button
                  key={category}
                  className="rounded-full border bg-white px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors first:bg-foreground first:text-background hover:text-foreground"
                >
                  {category}
                </button>
              ))}
            </div>

            <Link
              href={`/blog/${featured.slug}`}
              className="group mt-14 grid gap-8 rounded-[2rem] border bg-white p-4 shadow-xl transition-shadow hover:shadow-2xl md:grid-cols-[1.1fr_0.9fr] md:p-6"
            >
              <BlogCover index={0} />
              <div className="flex flex-col justify-center p-2 md:p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Featured
                </p>
                <h2 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
                  {featured.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                  {featured.excerpt}
                </p>
                <div className="mt-8 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {featured.date} · {featured.readTime}
                  </span>
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    Read article
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-[1.5rem] border bg-white p-4 shadow-sm transition-shadow hover:shadow-lg"
                >
                  <BlogCover index={index + 1} />
                  <div className="p-2 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {post.category}
                    </p>
                    <h2 className="mt-3 text-xl font-bold leading-tight group-hover:underline">
                      {post.title}
                    </h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                    <p className="mt-5 text-sm text-muted-foreground">
                      {post.date} · {post.readTime}
                    </p>
                  </div>
                </Link>
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
