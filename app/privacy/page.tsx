import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How we collect, use, and protect your data on this site.'
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <p>
        This Privacy Policy describes how your information is collected, used,
        and shared when you visit this website.
      </p>

      <h2>Information we collect</h2>
      <p>
        When you use the site, we may automatically collect certain information
        about your device, including your browser type, IP address, and how you
        interact with the site. We collect this using cookies and similar
        technologies.
      </p>

      <h2>Cookies and advertising</h2>
      <p>
        We use Google AdSense to display advertisements. Third-party vendors,
        including Google, use cookies to serve ads based on your prior visits to
        this and other websites. Google&apos;s use of advertising cookies
        enables it and its partners to serve ads to you based on your visit to
        this site and/or other sites on the Internet.
      </p>
      <p>
        You may opt out of personalized advertising by visiting{' '}
        <a
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Ads Settings
        </a>
        . You can also learn more about how vendors use cookies at{' '}
        <a
          href="https://www.aboutads.info/choices/"
          target="_blank"
          rel="noopener noreferrer"
        >
          aboutads.info
        </a>
        .
      </p>

      <h2>How we use your information</h2>
      <p>
        We use the information collected to operate and improve the site,
        understand how visitors use it, and serve relevant advertising.
      </p>

      <h2>Third-party services</h2>
      <p>
        This site may use third-party services such as analytics and AI
        providers to deliver its features. These services may process data
        according to their own privacy policies.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have rights regarding your personal
        data, including the right to access, correct, or delete it. To make a
        request, contact us through our contact page.
      </p>

      <h2>Contact</h2>
      <p>
        If you have questions about this Privacy Policy, please reach us via the{' '}
        <a href="/contact">contact page</a>.
      </p>
    </main>
  )
}
