import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';
import { GiftSettingsProvider } from './context/GiftSettingsContext';
import { PageContentProvider, usePageContent } from './context/PageContentContext';
import { CategoryProvider } from './context/CategoryContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import GiftFinder from './pages/GiftFinder';
import About from './pages/About';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Admin from './pages/Admin';
import Login from './pages/Login';
import CustomPage from './pages/CustomPage';
import FormPage from './pages/FormPage';
import NotFound from './pages/NotFound';
import ScrollToTop from './components/ScrollToTop';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PageRoute({ slug, children }) {
  const { pagesMeta, loading } = usePageContent();
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }
  const meta = pagesMeta.find((p) => p.slug === slug);
  if (meta && meta.hidden) return <NotFound />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CategoryProvider>
      <ProductProvider>
        <GiftSettingsProvider>
        <PageContentProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col">
            <Header />
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<PageRoute slug="home"><Home /></PageRoute>} />
                <Route path="/products" element={<PageRoute slug="products"><Products /></PageRoute>} />
                <Route path="/products/:id" element={<PageRoute slug="products"><ProductDetail /></PageRoute>} />
                <Route path="/gift-finder" element={<GiftFinder />} />
                <Route path="/about" element={<PageRoute slug="about"><About /></PageRoute>} />
                <Route path="/contact" element={<PageRoute slug="contact"><Contact /></PageRoute>} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/page/:slug" element={<CustomPage />} />
                <Route path="/form/:slug" element={<FormPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </BrowserRouter>
        </PageContentProvider>
        </GiftSettingsProvider>
      </ProductProvider>
      </CategoryProvider>
    </AuthProvider>
  );
}
