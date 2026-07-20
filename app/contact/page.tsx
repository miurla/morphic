import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with us.'
}

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose dark:prose-invert">
      <h1>Contact Us</h1>
      <p>
        We&apos;d love to hear from you. Whether you have feedback, a question,
        or a business inquiry, please reach out.
      </p>
      <p>
        Email:{' '}
        <a href="mailto:youremail@example.com">youremail@example.com</a>
      </p>
      <p>We aim to respond to all messages within a few business days.</p>
    </main>
  )
}
