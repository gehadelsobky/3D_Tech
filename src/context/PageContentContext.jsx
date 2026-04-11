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
  const { _ar, ...en } = content;
  if (!_ar || typeof _ar !== 'object') return en;

  const merged = { ...en };
  for (const [key, arVal] of Object.entries(_ar)) {
    if (!arVal) continue; // skip empty values — fallback to English
    if (typeof arVal === 'string' && arVal.trim()) {
      merged[key] = arVal;
    } else if (Array.isArray(arVal) && arVal.length > 0) {
      // For arrays, replace only non-empty items
      if (typeof arVal[0] === 'string') {
        merged[key] = (en[key] || []).map((enItem, i) => arVal[i]?.trim() ? arVal[i] : enItem);
      } else if (typeof arVal[0] === 'object') {
        merged[key] = (en[key] || []).map((enItem, i) => {
          if (!arVal[i]) return enItem;
          const obj = { ...enItem };
          for (const [f, v] of Object.entries(arVal[i])) {
            if (v && typeof v === 'string' && v.trim()) obj[f] = v;
          }
          return obj;
        });
      }
    }
  }
  return merged;
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
