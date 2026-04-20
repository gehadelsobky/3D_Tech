import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';
import { useLanguage } from './LanguageContext';

const PageContentContext = createContext();

export function PageContentProvider({ children }) {
  const [pages, setPages] = useState({});
  const [pagesMeta, setPagesMeta] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPages = useCallback(async () => {
    try {
      const list = await apiGet('/pages');
      setPagesMeta(list);

      const contentEntries = await Promise.all(
        list.map(async (p) => {
          try {
            const content = await apiGet(`/pages/${p.slug}`);
            return [p.slug, content];
          } catch {
            return [p.slug, {}];
          }
        })
      );
      setPages(Object.fromEntries(contentEntries));
    } catch {
      // fallback: empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

  const updatePage = useCallback(async (slug, content) => {
    const updated = await apiPut(`/pages/${slug}`, content);
    setPages((prev) => ({ ...prev, [slug]: updated }));
    return updated;
  }, []);

  const refreshPages = useCallback(() => {
    return loadPages();
  }, [loadPages]);

  return (
    <PageContentContext.Provider value={{ pages, pagesMeta, loading, updatePage, refreshPages }}>
      {children}
    </PageContentContext.Provider>
  );
}

// Helper: merge English content with Arabic overrides based on current language
function localizeContent(content, lang) {
  if (!content || lang !== 'ar') return content;
  try {
    const { _ar, ...en } = content;
    if (!_ar || typeof _ar !== 'object') return en;

    const merged = { ...en };
    for (const [key, arVal] of Object.entries(_ar)) {
      if (!arVal) continue; // skip empty values — fallback to English
      if (typeof arVal === 'string' && arVal.trim()) {
        merged[key] = arVal;
      } else if (Array.isArray(arVal) && arVal.length > 0) {
        const firstItem = arVal[0];
        // Array of strings
        if (typeof firstItem === 'string') {
          merged[key] = (en[key] || []).map((enItem, i) =>
            (typeof arVal[i] === 'string' && arVal[i].trim()) ? arVal[i] : enItem
          );
        // Array of objects (e.g. services, stats)
        } else if (firstItem && typeof firstItem === 'object') {
          merged[key] = (en[key] || []).map((enItem, i) => {
            const arItem = arVal[i];
            if (!arItem || typeof arItem !== 'object') return enItem;
            const obj = { ...enItem };
            for (const [f, v] of Object.entries(arItem)) {
              if (typeof v === 'string' && v.trim()) {
                // string field → override
                obj[f] = v;
              } else if (Array.isArray(v) && v.length > 0) {
                // nested string array (e.g. points) → override non-empty items
                obj[f] = (enItem[f] || []).map((enPt, j) =>
                  (typeof v[j] === 'string' && v[j].trim()) ? v[j] : enPt
                );
              }
            }
            return obj;
          });
        }
      }
    }
    return merged;
  } catch {
    // on any error, return English content
    const { _ar: _ignored, ...en } = content;
    return en;
  }
}

export function usePageContent(slug) {
  const ctx = useContext(PageContentContext);
  const { lang } = useLanguage();

  const rawContent = slug ? ctx.pages[slug] || {} : ctx.pages;

  // For single slug: localize that page's content
  // For all pages (no slug): return raw (admin usage)
  const content = slug ? localizeContent(rawContent, lang) : rawContent;
  const global = localizeContent(ctx.pages.global || {}, lang);

  return {
    content,
    global,
    pagesMeta: ctx.pagesMeta,
    loading: ctx.loading,
    updatePage: ctx.updatePage,
    refreshPages: ctx.refreshPages,
  };
}
