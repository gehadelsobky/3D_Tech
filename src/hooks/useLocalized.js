import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Returns a localized version of a product based on current language.
 * Arabic fields override English fields when available.
 */
function localizeProduct(product, lang) {
  if (lang !== 'ar' || !product) return product;
  return {
    ...product,
    name: product.nameAr || product.name,
    description: product.descriptionAr || product.description,
    features: (product.featuresAr?.length && product.featuresAr.some(f => f)) ? product.featuresAr.map((f, i) => f || product.features?.[i] || '') : product.features,
    brandingOptions: (product.brandingOptionsAr?.length && product.brandingOptionsAr.some(f => f)) ? product.brandingOptionsAr.map((f, i) => f || product.brandingOptions?.[i] || '') : product.brandingOptions,
    leadTime: product.leadTimeAr || product.leadTime,
    priceRange: product.priceRangeAr || product.priceRange,
    notes: product.notesAr || product.notes,
  };
}

function localizeCategory(category, lang) {
  if (lang !== 'ar' || !category) return category;
  return {
    ...category,
    name: category.name_ar || category.name,
    description: category.description_ar || category.description,
  };
}

/**
 * Hook: returns localized products array
 */
export function useLocalizedProducts(products) {
  const { lang } = useLanguage();
  return useMemo(
    () => products.map(p => localizeProduct(p, lang)),
    [products, lang]
  );
}

/**
 * Hook: returns localized single product
 */
export function useLocalizedProduct(product) {
  const { lang } = useLanguage();
  return useMemo(() => localizeProduct(product, lang), [product, lang]);
}

/**
 * Hook: returns localized categories array
 */
export function useLocalizedCategories(categories) {
  const { lang } = useLanguage();
  return useMemo(
    () => categories.map(c => localizeCategory(c, lang)),
    [categories, lang]
  );
}

/**
 * Hook: returns localized blog post
 */
export function useLocalizedBlogPost(post) {
  const { lang } = useLanguage();
  return useMemo(() => {
    if (lang !== 'ar' || !post) return post;
    return {
      ...post,
      title: post.title_ar || post.title,
      excerpt: post.excerpt_ar || post.excerpt,
      content: post.content_ar || post.content,
    };
  }, [post, lang]);
}

/**
 * Hook: returns localized blog posts array
 */
export function useLocalizedBlogPosts(posts) {
  const { lang } = useLanguage();
  return useMemo(
    () => posts.map(p => lang !== 'ar' ? p : {
      ...p,
      title: p.title_ar || p.title,
      excerpt: p.excerpt_ar || p.excerpt,
      content: p.content_ar || p.content,
    }),
    [posts, lang]
  );
}
