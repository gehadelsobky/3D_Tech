import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/products')
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <ProductContext.Provider value={{ products, loading, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProducts = () => useContext(ProductContext);
