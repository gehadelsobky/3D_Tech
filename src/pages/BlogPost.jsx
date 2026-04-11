import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useLocalizedBlogPost } from '../hooks/useLocalized';
import SEO from '../components/SEO';

export default function BlogPost() {
  const { slug } = useParams();
  const [rawPost, setRawPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { t } = useLanguage();
  const post = useLocalizedBlogPost(rawPost);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/blog/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setRawPost(data); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">{t('common.loading')}</div>
      </main>
    );
  }

  if (notFound || !post) return <Navigate to="/blog" />;

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title={post.title}
        description={post.excerpt?.slice(0, 160) || post.title}
        image={post.cover_image || undefined}
        type="article"
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-8">
          <Link to="/" className="hover:text-primary no-underline text-text-muted">{t('nav.home')}</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-primary no-underline text-text-muted">Blog</Link>
          <span>/</span>
          <span className="text-text truncate max-w-[200px]">{post.title}</span>
        </nav>

        {/* Cover Image */}
        {post.cover_image && (
          <div className="aspect-[16/9] rounded-xl overflow-hidden mb-8">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm text-text-muted">{new Date(post.created_at).toLocaleDateString()}</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-text-muted">{post.author}</span>
          {post.tags?.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-red-50 text-primary rounded-full">{tag}</span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-text mb-6">{post.title}</h1>

        {/* Content */}
        <div
          className="prose prose-gray max-w-none text-text-muted leading-relaxed [&_h2]:text-text [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-text [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:mb-2 [&_blockquote]:border-s-4 [&_blockquote]:border-primary [&_blockquote]:ps-4 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_img]:rounded-lg [&_img]:my-6 [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Back to Blog */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link to="/blog" className="text-primary font-medium no-underline hover:underline">&larr; Back to Blog</Link>
        </div>
      </article>
    </main>
  );
}
