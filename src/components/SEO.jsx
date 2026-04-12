import { useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

const SITE_NAME = '3D Tech';
const DEFAULT_DESCRIPTION_EN = 'Custom 3D printed promotional products, corporate giveaways, and branded merchandise. Engineering models, prototyping, and premium corporate gifts.';
const DEFAULT_DESCRIPTION_AR = 'منتجات ترويجية مطبوعة بتقنية 3D، هدايا شركات مخصصة، ونماذج هندسية. حلول طباعة ثلاثية الأبعاد احترافية في مصر.';
const DEFAULT_IMAGE = '/logo.jpeg';

/**
 * SEO component — dynamically updates document head with title, meta, OG, and Twitter tags.
 *
 * @param {string} title        — Page title (appended with " | 3D Tech")
 * @param {string} description  — Meta description (max ~160 chars)
 * @param {string} image        — OG/Twitter image URL
 * @param {string} url          — Canonical URL (defaults to current path)
 * @param {string} type         — OG type (default: "website")
 * @param {object} structuredData — JSON-LD structured data object
 */
export default function SEO({
  title,
  titleAr,
  description,
  descriptionAr,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  structuredData,
}) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const effectiveDescription = isAr
    ? (descriptionAr || description || DEFAULT_DESCRIPTION_AR)
    : (description || DEFAULT_DESCRIPTION_EN);

  const effectiveTitle = isAr ? (titleAr || title) : title;
  const structuredDataStr = useMemo(() => structuredData ? JSON.stringify(structuredData) : '', [structuredData]);

  useEffect(() => {
    // Title
    const defaultTitle = isAr
      ? `${SITE_NAME} - منتجات ترويجية وهدايا شركات مطبوعة بتقنية 3D`
      : `${SITE_NAME} - Custom 3D Printed Giveaways & Promotional Products`;
    const fullTitle = effectiveTitle ? `${effectiveTitle} | ${SITE_NAME}` : defaultTitle;
    document.title = fullTitle;

    // Helper to set or create a meta tag
    const setMeta = (attr, key, content) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Basic meta
    setMeta('name', 'description', effectiveDescription);

    // Language
    setMeta('property', 'og:locale', isAr ? 'ar_EG' : 'en_US');

    // Canonical URL
    const canonical = url || window.location.origin + window.location.pathname;
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonical);

    // Open Graph
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', effectiveDescription);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:site_name', SITE_NAME);
    if (image) {
      const absoluteImage = image.startsWith('http') ? image : window.location.origin + image;
      setMeta('property', 'og:image', absoluteImage);
    }

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', effectiveDescription);
    if (image) {
      const absoluteImage = image.startsWith('http') ? image : window.location.origin + image;
      setMeta('name', 'twitter:image', absoluteImage);
    }

    // JSON-LD Structured Data
    let scriptEl = document.querySelector('script[data-seo-ld]');
    if (structuredDataStr) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.setAttribute('type', 'application/ld+json');
        scriptEl.setAttribute('data-seo-ld', 'true');
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = structuredDataStr;
    } else if (scriptEl) {
      scriptEl.remove();
    }

    // Cleanup structured data on unmount
    return () => {
      const el = document.querySelector('script[data-seo-ld]');
      if (el) el.remove();
    };
  }, [effectiveTitle, effectiveDescription, image, url, type, structuredDataStr, isAr]);

  return null; // This component renders nothing
}
