import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGiftSettings } from '../context/GiftSettingsContext';
import { usePageContent } from '../context/PageContentContext';
import { apiPost } from '../lib/api';

const initialForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  giftType: '',
  product: '',
  quantity: '',
  budget: '',
  deliveryDate: '',
  notes: '',
  honeypot: '',
};

export default function Contact() {
  const [searchParams] = useSearchParams();
  const { settings } = useGiftSettings();
  const { content: c, global: g } = usePageContent('contact');
  const giftTypes = settings?.giftTypes || [];
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const product = searchParams.get('product');
    const giftType = searchParams.get('giftType');
    if (product || giftType) {
      setForm((prev) => ({
        ...prev,
        product: product || prev.product,
        giftType: giftType || prev.giftType,
      }));
    }
  }, [searchParams]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (form.honeypot) return null;
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs === null) return;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitError('');
    setSubmitting(true);
    try {
      const { honeypot, ...data } = form;
      await apiPost('/forms/quote-request/submit', { ...data, _hp: honeypot });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  if (submitted) {
    const successMsg = (c.successMessage || "Thank you, {name}. We've received your request and will get back to you within 24 hours.").replace('{name}', form.name);
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center py-20">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-3">{c.successTitle || 'Quote Request Sent!'}</h2>
          <p className="text-text-muted mb-6">{successMsg}</p>
          <button
            onClick={() => { setSubmitted(false); setForm(initialForm); }}
            className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark cursor-pointer transition-colors border-none"
          >
            {c.successButton || 'Submit Another Request'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-surface min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Form */}
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold text-text mb-2">{c.title || 'Request a Quote'}</h1>
            <p className="text-text-muted mb-8">{c.description || "Tell us about your project and we'll prepare a custom quote for you."}</p>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 space-y-5">
              <div className="hidden" aria-hidden="true">
                <input type="text" name="honeypot" value={form.honeypot} onChange={handleChange} tabIndex={-1} autoComplete="off" />
              </div>

              {form.product && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-primary">
                  Requesting quote for: <strong>{form.product}</strong>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Name *</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${errors.name ? 'border-red-300' : 'border-gray-200'}`} placeholder="John Smith" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Company</label>
                  <input type="text" name="company" value={form.company} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Acme Corp" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Email *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${errors.email ? 'border-red-300' : 'border-gray-200'}`} placeholder="john@example.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Phone *</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${errors.phone ? 'border-red-300' : 'border-gray-200'}`} placeholder="+20 10XXXXXXXX" />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Gift Type</label>
                  <select name="giftType" value={form.giftType} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                    <option value="">Select gift type</option>
                    {giftTypes.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Quantity</label>
                  <input type="text" name="quantity" value={form.quantity} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="e.g. 100 units" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Budget</label>
                  <input type="text" name="budget" value={form.budget} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="e.g. EGP 5000 - EGP 10000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Delivery Date</label>
                  <input type="date" name="deliveryDate" value={form.deliveryDate} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Additional Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" placeholder="Tell us about your project, branding needs, or any specific requirements..." />
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{submitError}</div>
              )}

              <button type="submit" disabled={submitting} className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors cursor-pointer border-none disabled:opacity-50">
                {submitting ? 'Submitting...' : (c.submitButton || 'Submit Quote Request')}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-text mb-4">Contact Information</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-text-muted mb-1">Email</div>
                  <div className="font-medium text-text">{g.email || 'info@3dtecheg.com'}</div>
                </div>
                <div>
                  <div className="text-text-muted mb-1">Phone</div>
                  <div className="font-medium text-text">{g.phone1 || '+201018559479'}</div>
                  {g.phone2 && <div className="font-medium text-text">{g.phone2}</div>}
                </div>
                <div>
                  <div className="text-text-muted mb-1">Location</div>
                  <div className="font-medium text-text">{g.location || 'Cairo, Egypt'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-text mb-4">Why {g.companyName || '3DTech'}?</h3>
              <ul className="space-y-3 text-sm text-text-muted list-none p-0 m-0">
                {(g.whyUs || ['Free design mockup', '24-hour quote turnaround', 'No hidden fees', 'Bulk order discounts', 'Quality guarantee']).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
