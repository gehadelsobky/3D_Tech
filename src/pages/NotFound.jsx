import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <main className="bg-surface min-h-screen flex items-center justify-center">
      <div className="text-center px-4 py-20">
        <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-text mb-3">{t('notFound.title')}</h1>
        <p className="text-text-muted mb-8 max-w-sm mx-auto">
          {t('notFound.message')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors no-underline"
          >
            {t('notFound.backHome')}
          </Link>
          <Link
            to="/products"
            className="px-6 py-2.5 bg-white border border-gray-200 text-text-muted font-medium rounded-lg hover:bg-gray-50 transition-colors no-underline"
          >
            {t('products.title')}
          </Link>
        </div>
      </div>
    </main>
  );
}
