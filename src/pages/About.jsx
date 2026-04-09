import { Link } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';

export default function About() {
  const { content: c } = usePageContent('about');

  const defaultSteps = [
    { number: '01', title: 'Tell Us Your Needs', description: 'Submit a quote request with your project details, audience, and timeline.' },
    { number: '02', title: 'Design & Mockup', description: 'Our team creates a custom 3D design mockup for your approval.' },
    { number: '03', title: 'Production', description: 'Once approved, we begin printing using industrial-grade materials.' },
    { number: '04', title: 'Delivery', description: 'Quality-checked products are packaged and shipped to your door.' },
  ];

  const defaultStats = [
    { value: '2019', label: 'Founded' },
    { value: '500+', label: 'Projects Completed' },
    { value: '50+', label: 'Active Clients' },
    { value: '10+', label: '3D Printers' },
  ];

  const defaultParagraphs = [
    'Founded with a passion for innovation and branding, 3DTech started as a small workshop with a single 3D printer and a big vision: to transform how companies think about promotional products.',
    'Today, we operate a full production facility equipped with industrial-grade FDM and SLA printers, serving clients from startups to Fortune 500 companies. Every product we create is custom-designed to reflect your brand\'s unique identity.',
    'What sets us apart is our end-to-end approach. From initial design consultation to final delivery, we handle every step with precision and care.',
  ];

  return (
    <main className="bg-surface min-h-screen">
      {/* Hero */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-text mb-6">
              {c.heroTitle1 || 'We Bring Brands to Life in'} <span className="text-primary">{c.heroTitle2 || 'Three Dimensions'}</span>
            </h1>
            <p className="text-lg text-text-muted leading-relaxed">
              {c.heroDescription || '3DTech combines cutting-edge 3D printing technology with creative design to produce unique, custom promotional products that leave a lasting impression.'}
            </p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold text-text mb-4">{c.storyTitle || 'Our Story'}</h2>
              <div className="space-y-4 text-text-muted leading-relaxed">
                {(c.storyParagraphs || defaultParagraphs).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-8">
              <div className="grid grid-cols-2 gap-6">
                {(c.storyStats || defaultStats).map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-sm text-text-muted mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-text mb-10 text-center">{c.processTitle || 'How It Works'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {(c.processSteps || defaultSteps).map((item) => (
              <div key={item.number} className="relative bg-surface rounded-xl p-6 border border-gray-100">
                <div className="text-3xl font-bold text-primary/20 mb-3">{item.number}</div>
                <h3 className="font-semibold text-text mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{c.ctaTitle || "Let's Create Something Amazing"}</h2>
          <p className="text-red-100 mb-8 max-w-lg mx-auto">
            {c.ctaDescription || 'Ready to elevate your brand with custom 3D-printed products? Get started with a free quote.'}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-50 transition-colors no-underline"
          >
            {c.ctaButton || 'Get a Free Quote'}
          </Link>
        </div>
      </section>
    </main>
  );
}
