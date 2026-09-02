import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { apiPost } from '../lib/api';

// Mirrors RESET_TOKEN_TTL_MINUTES in server/passwordReset.js.
const RESET_TTL_MINUTES = 30;

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('login.errEmailRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiPost('/auth/forgot-password', { email: email.trim() });
      // The API answers the same way whether or not the account exists, and so
      // does this screen — it must not become an account-enumeration oracle.
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <img src="/logo.jpeg" alt="3D Tech" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-text">{t('login.forgotTitle')}</h1>
            {!sent && <p className="text-text-muted text-sm mt-1">{t('login.forgotSubtitle')}</p>}
          </div>

          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-3" aria-hidden="true">📬</div>
              <h2 className="font-semibold text-text mb-2">{t('login.forgotSentTitle')}</h2>
              <p className="text-sm text-text-muted mb-6">
                {t('login.forgotSentText').replace('{minutes}', RESET_TTL_MINUTES)}
              </p>
              <Link to="/login" className="text-sm text-primary font-medium no-underline hover:underline">
                {t('login.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">{t('login.forgotEmail')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder={t('login.forgotEmailPlaceholder')}
                    autoComplete="email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 border-none cursor-pointer"
                >
                  {submitting ? t('login.forgotSending') : t('login.forgotSubmit')}
                </button>
              </form>
              <div className="text-center mt-5">
                <Link to="/login" className="text-sm text-text-muted no-underline hover:text-text">
                  {t('login.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
