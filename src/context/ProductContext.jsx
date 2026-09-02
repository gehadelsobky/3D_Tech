import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet('/products')
      .then(setProducts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = async (data) => {
    const created = await apiPost('/products', data);
    setProducts((prev) => [...prev, created]);
    return created;
  };

  const updateProduct = async (id, data) => {
    const updated = await apiPut(`/products/${id}`, data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const deleteProduct = async (id) => {
    await apiDelete(`/products/${id}`);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  /**
   * Persist a new catalogue order. Takes the products already in their target
   * order and renumbers them 0..n-1 so deletes never leave gaps behind.
   */
  const reorderProducts = useCallback(async (ordered) => {
    const payload = ordered.map((p, i) => ({ id: p.id, sort_order: i }));
    setProducts(ordered);              // optimistic — the list is already sorted
    const saved = await apiPut('/products/reorder/batch', { order: payload });
    setProducts(saved);
    return saved;
  }, []);

  return (
    <ProductContext.Provider value={{ products, loading, error, retry: fetchProducts, addProduct, updateProduct, deleteProduct, reorderProducts }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProducts = () => useContext(ProductContext);
