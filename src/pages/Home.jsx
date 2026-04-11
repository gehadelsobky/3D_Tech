import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { usePageContent } from '../context/PageContentContext';
import { useCategories } from '../context/CategoryContext';
import { useLocalizedProducts, useLocalizedCategories } from '../hooks/useLocalized';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

export default function Home() {
  const { products: rawProducts, loading } = useProducts();
  const { content: c } = usePageContent('home');
  const { categories: rawCategories } = useCategories();
  const products = useLocalizedProducts(rawProducts);
  const categories = useLocalizedCategories(rawCategories);
  const featured = products.slice(0, 4);

  return (
    <main>
      <SEO
        title={null}
        description="Custom 3D printed promotional products, corporate giveaways, and branded merchandise. Engineering models, prototyping, and premium corporate gifts in Egypt."
      />
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-accent-dark via-accent to-primary-dark overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 bg-white/10 text-accent text-sm font-medium rounded-full mb-6 border border-white/10">
              {c.heroBadge || '3D Printing & Corporate Gifts in Egypt'}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              {c.heroTitle1 || '3D Printing & Premium'}
              <br />
              <span className="text-accent">{c.heroTitle2 || 'Corporate Gifts'}</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-lg">
              {c.heroDescription || 'At 3DTECH, we turn ideas into real products and help companies deliver customized corporate gifts that clearly and professionally represent their brand.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/products"
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors no-underline"
              >
                {c.heroCta1 || 'Browse Products'}
              </Link>
              <Link
                to="/gift-finder"
                className="inline-flex items-center justify-center px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors no-underline border border-white/20"
              >
                {c.heroCta2 || 'Find the Perfect Gift'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {(c.stats || [
              { value: '500+', label: 'Projects Delivered' },
              { value: '50+', label: 'Corporate Clients' },
              { value: '24hr', label: 'Quote Turnaround' },
              { value: '100%', label: 'Custom Designs' },
            ]).map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-text mb-3">{c.categoriesTitle || 'Product Categories'}</h2>
            <p className="text-text-muted max-w-md mx-auto">
              {c.categoriesDescription || 'Explore our range of customizable 3D-printed promotional products.'}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?cat=${cat.id}`}
                className="group bg-white rounded-xl p-5 text-center border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all no-underline"
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-text mb-2">{c.featuredTitle || 'Featured Products'}</h2>
              <p className="text-text-muted">{c.featuredDescription || 'Popular items from our catalog'}</p>
            </div>
            <Link
              to="/products"
              className="hidden sm:inline-flex items-center text-sm font-medium text-primary hover:text-primary-dark no-underline transition-colors"
            >
              View All &rarr;
            </Link>
          </div>
          {loading ? (
            <div className="text-center py-12 text-text-muted">Loading products...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          <div className="mt-8 text-center sm:hidden">
            <Link
              to="/products"
              className="text-sm font-medium text-primary hover:text-primary-dark no-underline"
            >
              View All Products &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Why 3DTECH */}
      <section className="bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-text mb-3">{c.whyTitle || 'Why 3DTECH?'}</h2>
            <p className="text-text-muted max-w-md mx-auto">
              {c.whyDescription || 'What sets us apart in the Egyptian market'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {(c.whyReasons || [
              { icon: '🇪🇬', text: 'Practical experience in the Egyptian market' },
              { icon: '💡', text: 'From idea to execution' },
              { icon: '⏰', text: 'Clear commitment to deadlines' },
              { icon: '📦', text: 'Flexible production quantities' },
              { icon: '🤝', text: 'Direct communication and technical support' },
            ]).map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-5 text-center border border-gray-100">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-sm font-medium text-text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-text mb-10 text-center">{c.processTitle || 'How We Work'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(c.processSteps || [
              { number: '01', title: 'Receive Your Idea', description: 'We receive your idea or request' },
              { number: '02', title: 'Technical Review', description: 'Specification definition & feasibility' },
              { number: '03', title: '3D Design', description: 'Custom 3D design if required' },
              { number: '04', title: 'Production', description: 'Printing with industrial-grade printers' },
              { number: '05', title: 'Delivery', description: 'Testing, packaging & delivery' },
            ]).map((step) => (
              <div key={step.number} className="relative bg-surface rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-2xl font-bold text-primary/20 mb-2">{step.number}</div>
                <h3 className="font-semibold text-text text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-text-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{c.ctaTitle || 'Ready to Make Your Brand Stand Out?'}</h2>
          <p className="text-red-100 mb-8 max-w-lg mx-auto">
            {c.ctaDescription || 'Get a free quote for custom 3D-printed promotional products tailored to your brand.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-50 transition-colors no-underline"
            >
              {c.ctaButton || 'Request a Free Quote'}
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center px-8 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors no-underline border border-white/20"
            >
              {c.ctaButton2 || 'Explore Our Services'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
