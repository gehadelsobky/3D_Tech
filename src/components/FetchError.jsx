import { useLanguage } from '../context/LanguageContext';

export default function FetchError({ onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">{t('common.error')}</h3>
      <p className="text-sm text-text-muted mb-4">{t('errorBoundary.message')}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark cursor-pointer border-none transition-colors"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
