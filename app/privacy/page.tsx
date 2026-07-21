import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | Morphic AI',
  description: 'Detailed Privacy Policy for Morphic AI explaining data collection, cookies, Google AdSense, GDPR, and CCPA compliance.'
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground flex flex-col">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md py-4 px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">Morphic AI Privacy Center</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-16">
        <article className="prose dark:prose-invert max-w-none space-y-8">
          {/* Title Banner */}
          <div className="border-b border-border pb-8">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective Date: January 1, 2026 | Last Updated: July 2026
            </p>
          </div>

          <p className="text-base leading-relaxed text-muted-foreground">
            At <strong>Morphic AI</strong> (accessible from <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ai-morphic.vercel.app</code>), one of our main priorities is the privacy of our visitors. This Privacy Policy document contains detailed information on the types of data that are collected and recorded by Morphic AI and how we use, process, and safeguard it.
          </p>

          <p className="text-base leading-relaxed text-muted-foreground">
            If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us. This Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collected in Morphic AI.
          </p>

          <hr className="border-border my-8" />

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> 1. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal information.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Direct Interactions:</strong> If you contact us directly or provide feedback via our built-in feedback modules, we may receive additional information about you such as your name, email address, the contents of the message and/or attachments you may send us, and any other information you may choose to provide.
              </li>
              <li>
                <strong>Log Files:</strong> Morphic AI follows a standard procedure of using log files. These files log visitors when they visit websites. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> 2. Cookies and Web Beacons
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Like any other website, Morphic AI uses &apos;cookies&apos;. These cookies are used to store information including visitors&apos; preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users&apos; experience by customizing our web page content based on visitors&apos; browser type and/or other information.
            </p>
          </section>

          {/* Section 3 - AdSense Mandatory Compliance */}
          <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> 3. Google DoubleClick DART Cookie & Third-Party Advertising
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ai-morphic.vercel.app</code> and other sites on the internet.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              However, visitors may choose to decline the use of DART cookies by visiting the Google Ad and Content Network Privacy Policy at the following URL:{' '}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-medium"
              >
                https://policies.google.com/technologies/ads
              </a>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Some advertisers on our site may use cookies and web beacons. Our advertising partners include Google AdSense. Each of our advertising partners has their own Privacy Policy for their policies on user data.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> 4. How We Use Your Information
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use the information we collect in various ways, including to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
              <li>Provide, operate, and maintain our web application.</li>
              <li>Improve, personalize, and expand our web services and user interfaces.</li>
              <li>Understand and analyze how you interact with our real-time search synthesis engine.</li>
              <li>Develop new products, services, features, and capabilities.</li>
              <li>Process user feedback and provide technical support.</li>
              <li>Detect, prevent, and mitigate fraud or technical security vulnerabilities.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              5. CCPA Privacy Rights (Do Not Sell My Personal Information)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Under the CCPA, among other rights, California consumers have the right to request disclosure, deletion, or non-sale of personal data. If you make a request, we have one month to respond to you.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              6. GDPR Data Protection Rights
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every user is entitled to data access, rectification, erasure, and restriction rights under GDPR standards.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              7. Children&apos;s Information (COPPA Compliance)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Morphic AI does not knowingly collect any Personal Identifiable Information from children under the age of 13.
            </p>
          </section>

          {/* Contact Us Footer */}
          <div className="border-t border-border pt-8 mt-12">
            <h2 className="text-lg font-semibold text-foreground">Contact & Enquiries</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If you have any questions regarding our Privacy Policy, please reach out via our GitHub repository.
            </p>
          </div>
        </article>
      </main>
    </div>
  )
}
