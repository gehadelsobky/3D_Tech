import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';
import { GiftSettingsProvider } from './context/GiftSettingsContext';
import { PageContentProvider, usePageContent } from './context/PageContentContext';
import { CategoryProvider } from './context/CategoryContext';
import { LanguageProvider } from './context/LanguageContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages — each becomes a separate JS chunk
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const RequestProduct = lazy(() => import('./pages/RequestProduct'));
const GiftFinder = lazy(() => import('./pages/GiftFinder'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const CustomPage = lazy(() => import('./pages/CustomPage'));
const FormPage = lazy(() => import('./pages/FormPage'));
const Services = lazy(() => import('./pages/Services'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-text-muted">Loading...</div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PageRoute({ slug, children }) {
  const { pagesMeta, loading } = usePageContent();
  if (loading) return <PageLoader />;
  const meta = pagesMeta.find((p) => p.slug === slug);
  if (meta && meta.hidden) return <NotFound />;
  return children;
}

export default function App() {
  return (
    <LanguageProvider>
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
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<PageRoute slug="home"><Home /></PageRoute>} />
                  <Route path="/products" element={<PageRoute slug="products"><Products /></PageRoute>} />
                  <Route path="/products/:id" element={<PageRoute slug="products"><ProductDetail /></PageRoute>} />
                  <Route path="/request/:id" element={<RequestProduct />} />
                  <Route path="/gift-finder" element={<GiftFinder />} />
                  <Route path="/services" element={<PageRoute slug="services"><Services /></PageRoute>} />
                  <Route path="/about" element={<PageRoute slug="about"><About /></PageRoute>} />
                  <Route path="/contact" element={<PageRoute slug="contact"><Contact /></PageRoute>} />
                  <Route path="/privacy" element={<PageRoute slug="privacy"><Privacy /></PageRoute>} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/page/:slug" element={<CustomPage />} />
                  <Route path="/form/:slug" element={<FormPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </div>
            <Footer />
          </div>
        </BrowserRouter>
        </PageContentProvider>
        </GiftSettingsProvider>
      </ProductProvider>
      </CategoryProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}
