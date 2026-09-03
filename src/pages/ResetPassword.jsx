import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { apiGet, apiPost } from '../lib/api';

// Mirrors RESET_TOKEN_TTL_MINUTES in server/passwordReset.js.
const RESET_TTL_MINUTES = 30;
const MIN_PASSWORD_LENGTH = 8;

const cardClass = 'w-full max-w-md bg-white rounded-2xl shadow-lg p-8';
const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  // 'checking' → 'ready' | 'invalid' | 'done'
  const [status, setStatus] = useState('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate the link before showing the form, so an expired link says so
  // instead of failing only after the visitor has typed a new password.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus('invalid');
      return;
    }
    apiGet(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((data) => {
        if (cancelled) return;
        setUsername(data.username || '');
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('invalid'); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('login.errPasswordShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('login.errPasswordMismatch'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Could not reset the password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className={cardClass}>
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="3D Tech" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text">
            {status === 'invalid' ? t('login.resetInvalidTitle')
              : status === 'done' ? t('login.resetDoneTitle')
              : t('login.resetTitle')}
          </h1>
          {status === 'ready' && username && (
            <p className="text-text-muted text-sm mt-1">
              {t('login.resetFor').replace('{username}', username)}
            </p>
          )}
        </div>

        {status === 'checking' && (
          <p className="text-center text-sm text-text-muted">{t('login.resetChecking')}</p>
        )}

        {status === 'invalid' && (
          <div className="text-center">
            <div className="text-4xl mb-3" aria-hidden="true">⏳</div>
            <p className="text-sm text-text-muted mb-6">
              {t('login.resetInvalidText').replace('{minutes}', RESET_TTL_MINUTES)}
            </p>
            <Link
              to="/forgot-password"
              className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg font-medium no-underline hover:bg-primary-dark transition-colors"
            >
              {t('login.resetRequestNew')}
            </Link>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center">
            <div className="text-4xl mb-3" aria-hidden="true">✅</div>
            <p className="text-sm text-text-muted mb-6">{t('login.resetDoneText')}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors border-none cursor-pointer"
            >
              {t('login.resetGoToLogin')}
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Helps password managers associate the new credentials */}
              <input type="text" name="username" value={username} readOnly hidden autoComplete="username" />
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t('login.resetPassword')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder={t('login.resetPasswordPlaceholder')}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t('login.resetConfirm')}</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder={t('login.resetConfirmPlaceholder')}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 border-none cursor-pointer"
              >
                {submitting ? t('login.resetSubmitting') : t('login.resetSubmit')}
              </button>
            </form>
          </>
        )}

        {status !== 'done' && (
          <div className="text-center mt-5">
            <Link to="/login" className="text-sm text-text-muted no-underline hover:text-text">
              {t('login.backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
