export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
        <p className="mb-4">
          Welcome to Lucid Search, a service provided by AuroraSilicon. This
          Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our service. We are committed to
          protecting your privacy and ensuring transparency in our data
          practices.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">
          2. Information We Collect
        </h2>
        <h3 className="text-xl font-medium mb-2">2.1 Personal Information</h3>
        <p className="mb-4">
          We may collect personal information that you voluntarily provide to us
          when you:
        </p>
        <ul className="list-disc ml-6 mb-4">
          <li>Create an account</li>
          <li>Use our services</li>
          <li>Contact us</li>
          <li>Subscribe to our newsletters</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">
          3. How We Use Your Information
        </h2>
        <p className="mb-4">We use the information we collect to:</p>
        <ul className="list-disc ml-6 mb-4">
          <li>Provide and maintain our service</li>
          <li>Improve user experience</li>
          <li>Send you updates and notifications</li>
          <li>Respond to your inquiries</li>
          <li>Detect and prevent fraud</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
        <p className="mb-4">
          We implement appropriate technical and organizational security
          measures to protect your personal information. However, no method of
          transmission over the Internet is 100% secure.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
        <p className="mb-4">You have the right to:</p>
        <ul className="list-disc ml-6 mb-4">
          <li>Access your personal information</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Object to processing of your data</li>
          <li>Data portability</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
        <p className="mb-4">
          If you have any questions about this Privacy Policy or our data
          practices, please contact us at:
          <br />
          Email: support@lucidsearch.com
          <br />
          Company: AuroraSilicon
          <br />
          Responsible Officer: Yuhan Fu
        </p>
      </section>

      <footer className="text-sm text-gray-600">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p className="mt-2">
          AuroraSilicon © {new Date().getFullYear()} All rights reserved.
        </p>
      </footer>
    </div>
  )
}
