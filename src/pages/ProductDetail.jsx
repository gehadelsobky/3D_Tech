import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useLocalizedProducts } from '../hooks/useLocalized';
import { useLanguage } from '../context/LanguageContext';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.93)' }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer border-none"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
          {current + 1} / {images.length}
        </div>
      )}

      {/* Main image */}
      <div
        className="relative flex items-center justify-center w-full h-full px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[current]}
          alt={`Image ${current + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
          draggable={false}
        />
      </div>

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer border-none"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer border-none"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 flex gap-2 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-14 h-10 rounded-md overflow-hidden border-2 cursor-pointer p-0 transition-all ${
                i === current ? 'border-white opacity-100 scale-110' : 'border-white/30 opacity-50 hover:opacity-80'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProductDetail ─────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams();
  const { products: rawProducts, loading } = useProducts();
  const products = useLocalizedProducts(rawProducts);
  const product = products.find((p) => p.id === Number(id));
  const { t } = useLanguage();
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">{t('common.loading')}</div>
      </main>
    );
  }

  if (!product) return <Navigate to="/products" />;

  const relatedProducts = useMemo(() => {
    return products
      .filter(p => p.id !== product.id && p.category_id === product.category_id)
      .slice(0, 4);
  }, [products, product]);

  const images = Array.isArray(product.images)
    ? product.images
    : (typeof product.images === 'string' && product.images
        ? JSON.parse(product.images)
        : (product.image ? [product.image] : []));

  const productStructuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: images[0] || undefined,
    offers: product.price ? {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'EGP',
      availability: 'https://schema.org/InStock',
    } : undefined,
  }), [product]);

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} - Custom 3D printed product by 3D Tech`}
        image={images[0] || undefined}
        structuredData={productStructuredData}
      />

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <Lightbox
          images={images}
          startIndex={activeImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-8">
          <Link to="/" className="hover:text-primary no-underline text-text-muted">{t('nav.home')}</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-primary no-underline text-text-muted">{t('nav.products')}</Link>
          <span>/</span>
          <span className="text-text">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            {/* Main image — clickable to open lightbox */}
            <div
              className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 mb-3 relative group cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* Zoom hint overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-black/40 rounded-full p-3">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-16 rounded-lg overflow-hidden border-2 cursor-pointer p-0 transition-all ${
                      i === activeImage ? 'border-primary' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <span className="inline-block px-3 py-1 bg-red-50 text-primary text-xs font-medium rounded-full mb-3 capitalize">
              {product.category}
            </span>
            <h1 className="text-3xl font-bold text-text mb-4">{product.name}</h1>
            <p className="text-text-muted leading-relaxed mb-6">{product.description}</p>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-xs text-text-muted mb-1">{t('productDetail.priceRange')}</div>
                <div className="font-semibold text-text">{product.priceRange}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-xs text-text-muted mb-1">{t('productDetail.minOrder')}</div>
                <div className="font-semibold text-text">{product.moq} {t('products.units')}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-xs text-text-muted mb-1">{t('productDetail.leadTime')}</div>
                <div className="font-semibold text-text">{product.leadTime}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-xs text-text-muted mb-1">{t('productDetail.notes')}</div>
                <div className="font-semibold text-text text-sm">{product.notes}</div>
              </div>
            </div>

            {/* Features */}
            <div className="mb-6">
              <h3 className="font-semibold text-text mb-3">{t('productDetail.features')}</h3>
              <ul className="space-y-2">
                {product.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Branding Options */}
            <div className="mb-8">
              <h3 className="font-semibold text-text mb-3">{t('productDetail.brandingOptions')}</h3>
              <div className="flex flex-wrap gap-2">
                {product.brandingOptions.map((opt, i) => (
                  <span key={i} className="px-3 py-1.5 bg-gray-100 text-sm text-text-muted rounded-full">
                    {opt}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Link
              to={`/request/${product.id}`}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors no-underline"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {t('productDetail.requestItem')}
            </Link>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-text mb-6">{t('products.relatedTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
