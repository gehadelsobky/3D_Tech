import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';

const coreNavLinks = [
  { to: '/', label: 'Home', slug: 'home' },
  { to: '/services', label: 'Services', slug: 'services' },
  { to: '/products', label: 'Products', slug: 'products' },
  { to: '/gift-finder', label: 'Gift Finder' },
  { to: '/about', label: 'About', slug: 'about' },
  { to: '/contact', label: 'Get a Quote', slug: 'contact' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { global: g, pagesMeta } = usePageContent();

  const hiddenSlugs = useMemo(() => new Set((pagesMeta || []).filter(p => p.hidden).map(p => p.slug)), [pagesMeta]);
  const customPages = useMemo(() => (pagesMeta || []).filter(p => p.is_custom && !p.hidden), [pagesMeta]);

  const navLinks = useMemo(() => {
    const visible = coreNavLinks.filter(link => !link.slug || !hiddenSlugs.has(link.slug));
    const custom = customPages.map(p => ({ to: `/page/${p.slug}`, label: p.title || p.slug }));
    return [...visible, ...custom];
  }, [hiddenSlugs, customPages]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center no-underline">
            <img src={g.logoUrl || '/logo.jpeg'} alt={g.companyName || '3D Tech'} style={{ width: 60, height: 60 }} />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                  location.pathname === link.to
                    ? 'text-primary bg-red-50'
                    : 'text-text-muted hover:text-text hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block">
            <Link
              to="/contact"
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors no-underline"
            >
              {g.headerCta || 'Request Quote'}
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 border-none bg-transparent cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium no-underline ${
                  location.pathname === link.to
                    ? 'text-primary bg-red-50'
                    : 'text-text-muted hover:text-text hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/contact"
              onClick={() => setMobileOpen(false)}
              className="block mt-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg text-center no-underline"
            >
              {g.headerCta || 'Request Quote'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
