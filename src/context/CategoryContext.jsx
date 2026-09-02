import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';

const CategoryContext = createContext();

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet('/categories');
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /**
   * Persist a new display order. Takes the categories already in their target
   * order and renumbers them 0..n-1, so gaps left by deletes never accumulate.
   */
  const reorderCategories = useCallback(async (ordered) => {
    const payload = ordered.map((c, i) => ({ id: c.id, sort_order: i }));
    setCategories(ordered);            // optimistic — the list is already sorted
    const saved = await apiPut('/categories/reorder/batch', { order: payload });
    setCategories(saved);
    return saved;
  }, []);

  return (
    <CategoryContext.Provider value={{ categories, loading, refreshCategories: fetchCategories, reorderCategories }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  return ctx;
}
