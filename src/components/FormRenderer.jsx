import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../lib/api';

export default function FormRenderer({ slug }) {
  const [formDef, setFormDef] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet(`/forms/${slug}`)
      .then((data) => {
        setFormDef(data);
        const initial = {};
        data.fields.forEach((f) => { initial[f.name] = f.type === 'checkbox' ? false : ''; });
        setValues(initial);
      })
      .catch(() => setSubmitError('Form not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formDef) return;

    // Validate required fields
    const errs = {};
    formDef.fields.forEach((f) => {
      if (f.required && !values[f.name]?.toString().trim()) {
        errs[f.name] = `${f.label} is required`;
      }
      if (f.type === 'email' && values[f.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.name])) {
        errs[f.name] = 'Invalid email format';
      }
    });
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitError('');
    setSubmitting(true);
    try {
      await apiPost(`/forms/${slug}/submit`, values);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-text-muted">Loading form...</div>;
  if (!formDef) return <div className="text-center py-8 text-text-muted">{submitError || 'Form not available'}</div>;

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-text mb-2">{formDef.settings.successTitle || 'Thank You!'}</h3>
        <p className="text-text-muted">{formDef.settings.successMessage || 'Your submission has been received.'}</p>
        <button
          onClick={() => {
            setSubmitted(false);
            const initial = {};
            formDef.fields.forEach((f) => { initial[f.name] = f.type === 'checkbox' ? false : ''; });
            setValues(initial);
          }}
          className="mt-4 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark cursor-pointer border-none transition-colors text-sm font-medium"
        >
          Submit Another
        </button>
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formDef.fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-text mb-1.5">
            {field.label}{field.required ? ' *' : ''}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={`${inputClass} resize-none ${errors[field.name] ? 'border-red-300' : 'border-gray-200'}`}
            />
          ) : field.type === 'select' ? (
            <select
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={`${inputClass} bg-white ${errors[field.name] ? 'border-red-300' : 'border-gray-200'}`}
            >
              <option value="">Select...</option>
              {(field.options || []).filter(o => o.trim()).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values[field.name] || false}
                onChange={(e) => handleChange(field.name, e.target.checked)}
              />
              <span className="text-sm text-text-muted">{field.placeholder || field.label}</span>
            </label>
          ) : (
            <input
              type={field.type || 'text'}
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={`${inputClass} ${errors[field.name] ? 'border-red-300' : 'border-gray-200'}`}
            />
          )}
          {errors[field.name] && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}
        </div>
      ))}

      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{submitError}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors cursor-pointer border-none disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : (formDef.settings.submitButton || 'Submit')}
      </button>
    </form>
  );
}
