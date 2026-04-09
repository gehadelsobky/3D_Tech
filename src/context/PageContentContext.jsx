import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';

const PageContentContext = createContext();

export function PageContentProvider({ children }) {
  const [pages, setPages] = useState({});
  const [pagesMeta, setPagesMeta] = useState([]); // [{slug, title, hidden, is_custom, updated_at}]
  const [loading, setLoading] = useState(true);

  const loadPages = useCallback(async () => {
    try {
      // Fetch page list with metadata
      const list = await apiGet('/pages');
      setPagesMeta(list);

      // Fetch content for all pages (authenticated users can see hidden pages too)
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

export function usePageContent(slug) {
  const ctx = useContext(PageContentContext);
  return {
    content: slug ? ctx.pages[slug] || {} : ctx.pages,
    global: ctx.pages.global || {},
    pagesMeta: ctx.pagesMeta,
    loading: ctx.loading,
    updatePage: ctx.updatePage,
    refreshPages: ctx.refreshPages,
  };
}
