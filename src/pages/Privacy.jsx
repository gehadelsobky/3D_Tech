import { usePageContent } from '../context/PageContentContext';
import SEO from '../components/SEO';

export default function Privacy() {
  const { global: g } = usePageContent();
  const email = g.email || 'info@3dtecheg.com';
  const company = g.companyName || '3D Tech';

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Privacy Policy"
        description={`Privacy policy for ${company}. Learn how we collect, use, and protect your personal information.`}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-text mb-8">Privacy Policy</h1>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 space-y-6 text-sm text-text-muted leading-relaxed">
          <p className="text-xs text-text-muted">Last updated: February 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">1. Information We Collect</h2>
            <p>When you submit a quote request or contact us, we collect personal information such as your name, email address, phone number, and company name. We also collect information about your project requirements including product preferences, quantity, and budget.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">2. How We Use Your Information</h2>
            <p>We use the information you provide to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Respond to your inquiries and quote requests</li>
              <li>Provide and improve our products and services</li>
              <li>Communicate with you about your orders and projects</li>
              <li>Send relevant marketing communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">3. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your data with trusted service providers who assist us in operating our business, provided they agree to keep this information confidential.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">4. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">5. Cookies</h2>
            <p>Our website may use cookies to enhance your browsing experience. You can choose to disable cookies through your browser settings, though this may affect some functionality.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal information at any time. To exercise these rights, please contact us at {email}.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-2">7. Contact</h2>
            <p>If you have questions about this privacy policy, please contact us at:</p>
            <p className="mt-2 font-medium text-text">
              {company}<br />
              Email: {email}<br />
              Phone: {g.phone1 || '+201018559479'}{g.phone2 ? ` / ${g.phone2}` : ''}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
