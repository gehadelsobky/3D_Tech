import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="bg-surface min-h-screen flex items-center justify-center">
      <div className="text-center px-4 py-20">
        <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-text mb-3">Page Not Found</h1>
        <p className="text-text-muted mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors no-underline"
          >
            Go Home
          </Link>
          <Link
            to="/products"
            className="px-6 py-2.5 bg-white border border-gray-200 text-text-muted font-medium rounded-lg hover:bg-gray-50 transition-colors no-underline"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </main>
  );
}
