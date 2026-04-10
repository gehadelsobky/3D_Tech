import { Link } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';

const defaultValues = [
  { title: 'Customer First', description: 'Respecting customer needs, delivering a distinctive experience, and maintaining high quality with attention to the smallest details that matter to them.', icon: '👤' },
  { title: 'Team Spirit', description: 'Collaboration, mutual respect, and sharing knowledge and experience with both internal teams and freelancers to achieve success together.', icon: '🤝' },
  { title: 'Quality & Precision', description: 'Every product reflects our commitment to quality, precise execution, and design that fulfills the client\'s objective.', icon: '✅' },
  { title: 'Integrity & Commitment', description: 'We honor our promises and respect time and effort — whether with clients or partners.', icon: '🤲' },
  { title: 'Continuous Learning', description: 'Every project is an opportunity to learn and improve.', icon: '📚' },
];

const defaultSteps = [
  { number: '01', title: 'Receive Your Idea', description: 'We receive your idea or request and understand your vision and requirements.' },
  { number: '02', title: 'Technical Review', description: 'Technical review and specification definition to ensure feasibility and quality.' },
  { number: '03', title: '3D Design', description: 'Our team creates a custom 3D design tailored to your requirements.' },
  { number: '04', title: 'Production & Printing', description: 'Once approved, we begin production using industrial-grade 3D printers.' },
  { number: '05', title: 'Testing & Delivery', description: 'Quality-checked products are packaged and delivered to your door.' },
];

const defaultStats = [
  { value: '2019', label: 'Founded' },
  { value: '500+', label: 'Projects Completed' },
  { value: '50+', label: 'Active Clients' },
  { value: '10+', label: '3D Printers' },
];

const defaultWhyUs = [
  'Practical experience in the Egyptian market',
  'From idea to execution',
  'Clear commitment to deadlines',
  'Flexible production quantities',
  'Direct communication and technical support',
];

export default function About() {
  const { content: c } = usePageContent('about');

  return (
    <main className="bg-surface min-h-screen">
      {/* Hero */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-text mb-6">
              {c.heroTitle1 || 'About'} <span className="text-primary">{c.heroTitle2 || '3DTECH'}</span>
            </h1>
            <p className="text-lg text-text-muted leading-relaxed">
              {c.heroDescription || '3DTECH is a company specialized in 3D printing and customized corporate gifts. We have worked across multiple industries including real estate, pharmaceuticals, education, energy, and services. Our goal is simple: Turn ideas into tangible products with clear quality and structured execution.'}
            </p>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-xl">🔭</div>
                <h2 className="text-2xl font-bold text-text">{c.visionTitle || 'Our Vision'}</h2>
              </div>
              <p className="text-text-muted leading-relaxed">
                {c.visionText || 'Our vision at 3DTECH is to empower individuals and companies to transform their ideas into tangible, high-quality products through innovative 3D printing solutions. We aim to be a key partner in product development and customized gifts, with a strong focus on innovation, sustainability, and delivering an exceptional customer experience.'}
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-xl">🎯</div>
                <h2 className="text-2xl font-bold text-text">{c.missionTitle || 'Our Mission'}</h2>
              </div>
              <p className="text-text-muted leading-relaxed">
                {c.missionText || 'At 3DTECH, we transform ideas into high-quality products delivered with rapid execution to support entrepreneurs and businesses in developing their unique products and customized gifts. Through innovation, sustainability, and a strong customer experience, we provide 3D printing solutions that open new opportunities for growth and excellence in the Egyptian market.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-text mb-10 text-center">{c.valuesTitle || 'Core Values'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(c.coreValues || defaultValues).map((val, i) => (
              <div key={i} className="bg-surface rounded-xl p-6 border border-gray-100">
                <div className="text-2xl mb-3">{val.icon}</div>
                <h3 className="font-bold text-text mb-2">{val.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{val.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-xl border border-gray-100 p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {(c.storyStats || defaultStats).map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-text-muted mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why 3DTECH */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold text-text mb-6">{c.whyTitle || 'Why 3DTECH?'}</h2>
              <ul className="space-y-4">
                {(c.whyReasons || defaultWhyUs).map((reason, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-text-muted">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-8 border border-gray-100">
              <h3 className="text-lg font-bold text-text mb-4">{c.processTitle || 'How We Work'}</h3>
              <div className="space-y-4">
                {(c.processSteps || defaultSteps).map((step) => (
                  <div key={step.number} className="flex gap-4">
                    <div className="text-xl font-bold text-primary/30 w-8 shrink-0">{step.number}</div>
                    <div>
                      <h4 className="font-semibold text-text text-sm">{step.title}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
