import { useEffect } from 'react';

const SITE_NAME = '3D Tech';
const DEFAULT_DESCRIPTION = 'Custom 3D printed promotional products, corporate giveaways, and branded merchandise. Engineering models, prototyping, and premium corporate gifts.';
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
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  structuredData,
}) {
  useEffect(() => {
    // Title
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Custom 3D Printed Giveaways & Promotional Products`;
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
    setMeta('name', 'description', description);

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
    setMeta('property', 'og:description', description);
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
    setMeta('name', 'twitter:description', description);
    if (image) {
      const absoluteImage = image.startsWith('http') ? image : window.location.origin + image;
      setMeta('name', 'twitter:image', absoluteImage);
    }

    // JSON-LD Structured Data
    let scriptEl = document.querySelector('script[data-seo-ld]');
    if (structuredData) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.setAttribute('type', 'application/ld+json');
        scriptEl.setAttribute('data-seo-ld', 'true');
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(structuredData);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    // Cleanup structured data on unmount
    return () => {
      const el = document.querySelector('script[data-seo-ld]');
      if (el) el.remove();
    };
  }, [title, description, image, url, type, structuredData]);

  return null; // This component renders nothing
}
