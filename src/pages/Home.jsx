import { Link } from 'react-router-dom';
import { categories } from '../data/products';
import { useProducts } from '../context/ProductContext';
import { usePageContent } from '../context/PageContentContext';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const { products, loading } = useProducts();
  const { content: c } = usePageContent('home');
  const featured = products.slice(0, 4);

  return (
    <main>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-accent-dark via-accent to-primary-dark overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 bg-white/10 text-accent text-sm font-medium rounded-full mb-6 border border-white/10">
              {c.heroBadge || 'Custom 3D Printed Products'}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              {c.heroTitle1 || 'Branded Giveaways'}
              <br />
              <span className="text-accent">{c.heroTitle2 || 'Made Unique'}</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-lg">
              {c.heroDescription || 'Stand out with custom 3D-printed promotional products. From USB drives to desk accessories, we bring your brand to life in three dimensions.'}
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

      {/* CTA */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{c.ctaTitle || 'Ready to Make Your Brand Stand Out?'}</h2>
          <p className="text-red-100 mb-8 max-w-lg mx-auto">
            {c.ctaDescription || 'Get a free quote for custom 3D-printed promotional products tailored to your brand.'}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-50 transition-colors no-underline"
          >
            {c.ctaButton || 'Request a Free Quote'}
          </Link>
        </div>
      </section>
    </main>
  );
}
