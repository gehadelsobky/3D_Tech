import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useLocalizedBlogPosts } from '../hooks/useLocalized';
import SEO from '../components/SEO';

export default function Blog() {
  const [rawPosts, setRawPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const posts = useLocalizedBlogPosts(rawPosts);

  useEffect(() => {
    fetch('/api/blog')
      .then(r => r.json())
      .then(data => { setRawPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">{t('common.loading')}</div>
      </main>
    );
  }

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Blog"
        description="Read the latest articles, tips, and insights about 3D printing, corporate gifts, and promotional products."
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">{t('blog.title')}</h1>
          <p className="text-gray-300 max-w-xl mx-auto">{t('blog.subtitle')}</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">&#128221;</div>
            <h2 className="text-xl font-semibold text-text mb-2">{t('blog.noArticles')}</h2>
            <p className="text-text-muted">{t('blog.checkBack')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow no-underline"
              >
                {post.cover_image && (
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-text-muted">{new Date(post.created_at).toLocaleDateString()}</span>
                    {post.tags?.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-primary rounded-full">{post.tags[0]}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-text mb-2 group-hover:text-primary transition-colors">{post.title}</h2>
                  <p className="text-sm text-text-muted line-clamp-3">{post.excerpt}</p>
                  <div className="mt-3 text-sm font-medium text-primary">{t('common.learnMore')} &rarr;</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
