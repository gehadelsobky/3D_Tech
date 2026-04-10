import { Link } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';
import SEO from '../components/SEO';

const defaultPrintingServices = [
  {
    title: 'Engineering & Architectural Models',
    description: 'We convert drawings and plans into accurate physical models.',
    points: [
      'Ideal for real estate developers and engineering firms',
      'Helps present projects before execution',
      'Supports decision-making for clients and investors',
      'Produced according to required scale and specifications',
    ],
    icon: '🏗️',
  },
  {
    title: 'Product Prototyping',
    description: 'Turn your product idea into a functional prototype before manufacturing.',
    points: [
      'Test shape and size before production',
      'Suitable for startups and factories',
      'Fast iteration based on feedback',
    ],
    icon: '⚙️',
  },
  {
    title: 'Custom Mechanical Parts',
    description: 'Design and print parts based on required dimensions.',
    points: [
      'Practical solution for unavailable spare parts',
      'Suitable for maintenance and limited production',
      'Ability to test performance before scaling',
    ],
    icon: '🔧',
  },
  {
    title: 'Graduation Projects & Educational Models',
    description: 'Technical support to transform student ideas into professional models.',
    points: [
      'Suitable for engineering, arts, and architecture students',
      'On-time delivery with clear quality standards',
      'Technical guidance during execution',
    ],
    icon: '🎓',
  },
  {
    title: 'Decorative & Artistic Pieces',
    description: 'Custom-designed decorative items for offices and exhibitions.',
    points: [
      'Fully customized designs',
      'Suitable for branding or internal use',
      'Adds strong visual value',
    ],
    icon: '🎨',
  },
];

const defaultGiftServices = [
  {
    title: 'Year-End Corporate Gifts',
    description: 'Customized gifts branded with your company logo.',
    points: [
      'Ideal for clients and teams',
      'Options based on budget and quantity',
      'Ready-to-distribute packaging',
    ],
    icon: '🎁',
  },
  {
    title: 'Employee Gifts & Welcome Kits',
    description: 'Practical products for daily use.',
    points: [
      'Suitable for new employees and engagement campaigns',
      'Full branded packages available',
      'Organized and professional delivery',
    ],
    icon: '👋',
  },
  {
    title: 'Event & Exhibition Giveaways',
    description: 'Lightweight promotional items for events.',
    points: [
      'Designed to reflect your brand identity',
      'Bulk production with clear timelines',
      'Ideal for direct marketing',
    ],
    icon: '🎪',
  },
  {
    title: 'Awards & Recognition Gifts',
    description: 'Custom-designed trophies and awards.',
    points: [
      'Suitable for companies, universities, and institutions',
      'Designed to reflect the value of the occasion',
      'High-quality finishing and presentation',
    ],
    icon: '🏆',
  },
  {
    title: 'Seasonal Corporate Gifts',
    description: 'Gifts tailored for occasions such as Ramadan or New Year.',
    points: [
      'Can combine 3D printing with traditional products',
      'Designed based on your audience',
      'Helps maintain strong client relationships',
    ],
    icon: '🌙',
  },
];

export default function Services() {
  const { content: c } = usePageContent('services');

  const printingServices = c.printingServices || defaultPrintingServices;
  const giftServices = c.giftServices || defaultGiftServices;

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Services"
        description="3D printing services: engineering models, rapid prototyping, mechanical parts, graduation projects. Corporate gift solutions for every occasion."
      />
      {/* Hero */}
      <section className="bg-gradient-to-br from-accent-dark via-accent to-primary-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-white/10 text-accent text-sm font-medium rounded-full mb-4 border border-white/10">
              {c.heroBadge || 'What We Do'}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {c.heroTitle1 || '3D Printing & Premium'}{' '}
              <span className="text-accent">{c.heroTitle2 || 'Corporate Gifts'}</span>
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed max-w-2xl">
              {c.heroDescription || 'At 3DTECH, we turn ideas into real products and help companies deliver customized corporate gifts that clearly and professionally represent their brand.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3D Printing Services */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text mb-3">
              {c.printingTitle || '3D Printing Services'}
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              {c.printingDescription || 'Professional 3D printing solutions for engineering, product development, education, and creative projects across Egypt.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {printingServices.map((service, i) => (
              <div key={i} className="bg-surface rounded-xl p-6 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{service.icon}</div>
                <h3 className="text-lg font-bold text-text mb-2">{service.title}</h3>
                <p className="text-sm text-text-muted mb-4">{service.description}</p>
                <ul className="space-y-2">
                  {service.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-text-muted">
                      <svg className="w-4 h-4 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Gifts */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text mb-3">
              {c.giftsTitle || 'Corporate Gifts & Custom Giveaways'}
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              {c.giftsDescription || 'Customized promotional products and branded giveaways designed to represent your company with quality and professionalism.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {giftServices.map((service, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{service.icon}</div>
                <h3 className="text-lg font-bold text-text mb-2">{service.title}</h3>
                <p className="text-sm text-text-muted mb-4">{service.description}</p>
                <ul className="space-y-2">
                  {service.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-text-muted">
                      <svg className="w-4 h-4 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {c.ctaTitle || 'Ready to Get Started?'}
          </h2>
          <p className="text-red-100 mb-8 max-w-lg mx-auto">
            {c.ctaDescription || 'Send us your project details or required quantities, and we will respond with a clear quotation shortly.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-50 transition-colors no-underline"
            >
              {c.ctaButton1 || 'Request a Quote'}
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center justify-center px-8 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors no-underline border border-white/20"
            >
              {c.ctaButton2 || 'Browse Products'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
