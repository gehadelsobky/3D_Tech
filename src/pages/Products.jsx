import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { usePageContent } from '../context/PageContentContext';
import { useCategories } from '../context/CategoryContext';
import { useLocalizedProducts, useLocalizedCategories } from '../hooks/useLocalized';
import { useLanguage } from '../context/LanguageContext';
import ProductCard from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/Skeleton';
import FetchError from '../components/FetchError';
import SEO from '../components/SEO';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Products() {
  const { products: rawProducts, loading, error, retry } = useProducts();
  const { content: c } = usePageContent('products');
  const { categories: rawCategories } = useCategories();
  const products = useLocalizedProducts(rawProducts);
  const categories = useLocalizedCategories(rawCategories);
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const activeCategory = searchParams.get('cat') || 'all';

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, activeCategory, debouncedSearch]);

  const setCategory = (cat) => {
    if (cat === 'all') {
      searchParams.delete('cat');
    } else {
      searchParams.set('cat', cat);
    }
    setSearchParams(searchParams);
  };

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Products"
        titleAr="المنتجات"
        description="Browse our collection of custom 3D printed promotional products, corporate giveaways, keychains, USB drives, desk accessories and more."
        descriptionAr="تصفح مجموعتنا من المنتجات الترويجية المطبوعة بتقنية 3D، هدايا الشركات، سلاسل المفاتيح، الفلاشات، وإكسسوارات المكتب."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">{c.title || 'Product Catalog'}</h1>
          <p className="text-text-muted">{c.description || 'Browse our full range of customizable 3D-printed products'}</p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={c.searchPlaceholder || 'Search products...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                activeCategory === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-muted border-gray-200 hover:border-primary/30'
              }`}
            >
              {t('products.allCategories')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-muted border-gray-200 hover:border-primary/30'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : error ? (
          <FetchError onRetry={retry} />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold text-text mb-1">{c.noResultsTitle || t('products.noResults')}</h3>
            <p className="text-text-muted text-sm">{c.noResultsDescription || t('products.noResultsDescription')}</p>
          </div>
        )}

        <div className="mt-6 text-sm text-text-muted">
          {t('products.showingOf').replace('{count}', filtered.length).replace('{total}', products.length)}
        </div>
      </div>
    </main>
  );
}
