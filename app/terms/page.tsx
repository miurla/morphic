export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
        <p className="mb-4">
          By accessing or using Lucid Search, a service provided by
          AuroraSilicon, you agree to be bound by these Terms of Service and all
          applicable laws and regulations. If you do not agree with any of these
          terms, you are prohibited from using or accessing this service. These
          Terms of Service apply to all visitors, users, and others who access
          or use Lucid Search.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
        <p className="mb-4">
          Permission is granted to temporarily access and use Lucid Search for
          personal, non-commercial purposes. This is the grant of a license, not
          a transfer of title, and under this license you may not:
        </p>
        <ul className="list-disc ml-6 mb-4">
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose</li>
          <li>
            Attempt to decompile or reverse engineer any software contained in
            Lucid Search
          </li>
          <li>Remove any copyright or other proprietary notations</li>
          <li>Transfer the materials to another person</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. User Account</h2>
        <p className="mb-4">
          To access certain features of Lucid Search, you may be required to
          create an account. You are responsible for:
        </p>
        <ul className="list-disc ml-6 mb-4">
          <li>Maintaining the confidentiality of your account</li>
          <li>All activities that occur under your account</li>
          <li>Notifying us immediately of any unauthorized use</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Disclaimer</h2>
        <p className="mb-4">
          The materials on Lucid Search are provided on an &apos;as is&apos;
          basis. AuroraSilicon makes no warranties, expressed or implied, and
          hereby disclaims and negates all other warranties including, without
          limitation, implied warranties or conditions of merchantability,
          fitness for a particular purpose, or non-infringement of intellectual
          property or other violation of rights.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Limitations</h2>
        <p className="mb-4">
          In no event shall Lucid Search, AuroraSilicon, or its suppliers be
          liable for any damages (including, without limitation, damages for
          loss of data or profit, or due to business interruption) arising out
          of the use or inability to use Lucid Search.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Revisions and Errata</h2>
        <p className="mb-4">
          The materials appearing on Lucid Search could include technical,
          typographical, or photographic errors. AuroraSilicon does not warrant
          that any of the materials are accurate, complete or current. We may
          make changes to the materials at any time without notice.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">7. Governing Law</h2>
        <p className="mb-4">
          These terms and conditions are governed by and construed in accordance
          with the laws and any dispute shall be subject to the exclusive
          jurisdiction of the courts.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">8. Contact Information</h2>
        <p className="mb-4">
          If you have any questions about these Terms of Service, please contact
          us at:
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
