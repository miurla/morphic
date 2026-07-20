import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about our open-source AI-powered answer engine, how it works, and the mission behind it.'
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose dark:prose-invert">
      <h1>About This Site</h1>
      <p>
        This site is a free, open-source AI-powered answer engine. Our goal is
        to make finding trustworthy information faster by combining live web
        search with AI that summarizes and cites its sources.
      </p>
      <p>
        Unlike a traditional search page, answers are presented with a
        generative interface — meaning results can include images, structured
        grids, and clear headings alongside the text, all credited to the
        original sources.
      </p>
      <h2>What we value</h2>
      <p>
        We believe information should be transparent and verifiable. Every
        answer links back to where it came from so you can check the facts
        yourself. We also believe useful tools should be open and accessible,
        which is why the project is built on open-source technology.
      </p>
      <h2>Who runs this</h2>
      <p>
        This site is independently operated. If you have questions, feedback, or
        partnership inquiries, please visit our{' '}
        <a href="/contact">contact page</a>.
      </p>
    </main>
  )
}
