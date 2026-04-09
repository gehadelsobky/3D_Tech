import { useParams, Navigate } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';

export default function CustomPage() {
  const { slug } = useParams();
  const { content, loading, pagesMeta } = usePageContent(slug);

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </main>
    );
  }

  // Check if page exists and is not hidden
  const pageMeta = pagesMeta.find((p) => p.slug === slug);
  if (!pageMeta || pageMeta.hidden) {
    return <Navigate to="/404" replace />;
  }

  const { heroTitle, heroDescription, sections = [] } = content;

  return (
    <main className="bg-surface min-h-screen">
      {/* Hero */}
      {heroTitle && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-text mb-3">{heroTitle}</h1>
            {heroDescription && <p className="text-lg text-text-muted max-w-2xl mx-auto">{heroDescription}</p>}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {sections.map((section, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
            {section.title && <h2 className="text-xl font-semibold text-text mb-3">{section.title}</h2>}
            {section.body && (
              <div className="text-text-muted leading-relaxed whitespace-pre-line">{section.body}</div>
            )}
          </div>
        ))}

        {sections.length === 0 && !heroDescription && (
          <div className="text-center py-12 text-text-muted">
            <p>This page has no content yet. Edit it from the admin panel.</p>
          </div>
        )}
      </div>
    </main>
  );
}
