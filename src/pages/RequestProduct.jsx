import { useState, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useLocalizedProducts } from '../hooks/useLocalized';
import { usePageContent } from '../context/PageContentContext';
import { useLanguage } from '../context/LanguageContext';
import { apiPost } from '../lib/api';
import SEO from '../components/SEO';

export default function RequestProduct() {
  const { id } = useParams();
  const { products: rawProducts, loading } = useProducts();
  const products = useLocalizedProducts(rawProducts);
  const product = products.find((p) => p.id === Number(id));
  const { global: g } = usePageContent('contact');
  const { t, isRTL } = useLanguage();

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    quantity: '',
    deliveryDate: '',
    notes: '',
    honeypot: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const images = useMemo(() => {
    if (!product) return [];
    return Array.isArray(product.images)
      ? product.images
      : (typeof product.images === 'string' && product.images
          ? JSON.parse(product.images)
          : (product.image ? [product.image] : []));
  }, [product]);

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">{t('common.loading')}</div>
      </main>
    );
  }

  if (!product) return <Navigate to="/products" />;

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = t('contact.errNameRequired');
    if (!form.email.trim()) errs.email = t('contact.errEmailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('contact.errEmailInvalid');
    if (!form.phone.trim()) errs.phone = t('contact.errPhoneRequired');
    if (form.honeypot) return null;
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs === null) return; // honeypot triggered
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitError('');
    setSubmitting(true);
    try {
      const { honeypot, ...data } = form;
      await apiPost('/forms/quote-request/submit', {
        ...data,
        product: product.name,
        _hp: honeypot,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
  const inputErrClass = 'w-full px-3 py-2.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400';

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    const msg = t('request.successMessage')
      .replace('{name}', form.name)
      .replace('{product}', product.name);
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center px-4">
        <SEO title={`${t('request.title')} — ${product.name}`} />
        <div className="max-w-md w-full text-center py-20">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-3">{t('request.successTitle')}</h2>
          <p className="text-text-muted mb-8 leading-relaxed">{msg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/products"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors no-underline"
            >
              {t('request.successBack')}
            </Link>
            <button
              onClick={() => { setSubmitted(false); setForm({ name: '', company: '', email: '', phone: '', quantity: '', deliveryDate: '', notes: '', honeypot: '' }); }}
              className="inline-flex items-center justify-center px-6 py-2.5 border border-gray-200 text-text-muted font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer bg-white"
            >
              {t('request.sendAnother')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main page ───────────────────────────────────────────────────────────────
  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title={`${t('request.title')} — ${product.name}`}
        description={`Request a custom quote for ${product.name}. Fill out the quick form and get a response within 24 hours.`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-8 flex-wrap">
          <Link to="/" className="hover:text-primary no-underline text-text-muted">{t('nav.home')}</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-primary no-underline text-text-muted">{t('nav.products')}</Link>
          <span>/</span>
          <Link to={`/products/${product.id}`} className="hover:text-primary no-underline text-text-muted">{product.name}</Link>
          <span>/</span>
          <span className="text-text">{t('request.title')}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

          {/* ── LEFT: Product card ────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Product image */}
            {images[0] && (
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                <img
                  src={images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Product info card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div>
                <span className="inline-block px-2.5 py-1 bg-red-50 text-primary text-xs font-medium rounded-full capitalize mb-2">
                  {product.category}
                </span>
                <h2 className="text-xl font-bold text-text leading-snug">{product.name}</h2>
                <p className="text-sm text-text-muted mt-1 leading-relaxed line-clamp-3">{product.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                {product.priceRange && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t('productDetail.priceRange')}</div>
                    <div className="text-sm font-semibold text-text">{product.priceRange}</div>
                  </div>
                )}
                {product.moq && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t('productDetail.minOrder')}</div>
                    <div className="text-sm font-semibold text-text">{product.moq} {t('products.units')}</div>
                  </div>
                )}
                {product.leadTime && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t('productDetail.leadTime')}</div>
                    <div className="text-sm font-semibold text-text">{product.leadTime}</div>
                  </div>
                )}
              </div>

              {Array.isArray(product.features) && product.features.length > 0 && (
                <div className="pt-2 border-t border-gray-50">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{t('productDetail.features')}</div>
                  <ul className="space-y-1.5">
                    {product.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                        <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link
                to={`/products/${product.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline no-underline font-medium"
              >
                {isRTL ? (
                  <>
                    {t('request.backToProduct')}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('request.backToProduct')}
                  </>
                )}
              </Link>
            </div>

            {/* Contact info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 text-sm">
              <h4 className="font-semibold text-text">{t('contact.contactInfo')}</h4>
              <div className="space-y-2 text-text-muted">
                {g.email && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {g.email}
                  </div>
                )}
                {g.phone1 && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{g.phone1}{g.phone2 && ` / ${g.phone2}`}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Request form ───────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <h1 className="text-3xl font-bold text-text mb-2">{t('request.title')}</h1>
            <p className="text-text-muted mb-6">{t('request.subtitle')}</p>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-5">
              {/* honeypot */}
              <div className="hidden" aria-hidden="true">
                <input type="text" name="honeypot" value={form.honeypot} onChange={handleChange} tabIndex={-1} autoComplete="off" />
              </div>

              {/* Name + Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('contact.name')} *</label>
                  <input
                    type="text" name="name" value={form.name} onChange={handleChange}
                    className={errors.name ? inputErrClass : inputClass}
                    placeholder={t('contact.namePlaceholder')}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('contact.company')}</label>
                  <input
                    type="text" name="company" value={form.company} onChange={handleChange}
                    className={inputClass}
                    placeholder={t('contact.companyPlaceholder')}
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('contact.email')} *</label>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    className={errors.email ? inputErrClass : inputClass}
                    placeholder={t('contact.emailPlaceholder')}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('contact.phone')} *</label>
                  <input
                    type="tel" name="phone" value={form.phone} onChange={handleChange}
                    className={errors.phone ? inputErrClass : inputClass}
                    placeholder={t('contact.phonePlaceholder')}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Quantity + Delivery Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('request.quantity')}</label>
                  <input
                    type="text" name="quantity" value={form.quantity} onChange={handleChange}
                    className={inputClass}
                    placeholder={t('request.quantityPlaceholder')}
                  />
                  {product.moq && (
                    <p className="text-[11px] text-text-muted mt-1">
                      {t('productDetail.minOrder')}: {product.moq} {t('products.units')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('request.deliveryDate')}</label>
                  <input
                    type="date" name="deliveryDate" value={form.deliveryDate} onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t('request.notes')}</label>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange}
                  rows={4}
                  className={inputClass + ' resize-none'}
                  placeholder={t('request.notesPlaceholder')}
                />
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{submitError}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors cursor-pointer border-none disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('request.submitting')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {t('request.submit')}
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </main>
  );
}
