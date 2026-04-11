import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const matchBadgeKeys = [
  { key: 'budgetFit', tKey: 'giftFinder.budget', color: 'bg-green-50 text-green-700' },
  { key: 'deliveryFit', tKey: 'giftFinder.timeline', color: 'bg-blue-50 text-blue-700' },
  { key: 'audienceMatch', tKey: 'giftFinder.audience', color: 'bg-purple-50 text-purple-700' },
  { key: 'qtyFit', tKey: 'products.moq', color: 'bg-gray-100 text-gray-600' },
];

export default function ProductCard({ product, matchInfo }) {
  const { t } = useLanguage();
  return (
    <Link
      to={`/products/${product.id}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 no-underline block"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4">
        <span className="inline-block px-2 py-0.5 bg-red-50 text-primary text-xs font-medium rounded-full mb-2 capitalize">
          {product.category}
        </span>
        <h3 className="text-base font-semibold text-text mb-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-text-muted line-clamp-2 mb-3">
          {product.description}
        </p>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{product.priceRange}</span>
          <span>{t('products.moq')}: {product.moq}</span>
        </div>
        {matchInfo && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-100">
            {matchBadgeKeys.map(({ key, tKey, color }) =>
              matchInfo[key] ? (
                <span key={key} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${color}`}>
                  ✓ {t(tKey)}
                </span>
              ) : null
            )}
            {matchInfo.tagMatches > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-50 text-orange-700">
                ✓ {matchInfo.tagMatches} tag{matchInfo.tagMatches > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
