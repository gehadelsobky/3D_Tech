import { usePageContent } from '../context/PageContentContext';
import { useLanguage } from '../context/LanguageContext';
import SEO from '../components/SEO';

export default function Privacy() {
  const { content: c, global: g } = usePageContent('privacy');
  const { t, lang } = useLanguage();
  const email = g.email || 'info@3dtecheg.com';
  const company = g.companyName || '3D Tech';

  const sections = c.sections || [];
  const lastUpdated = c.lastUpdated || '';

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Privacy Policy"
        titleAr="سياسة الخصوصية"
        description={`Privacy policy for ${company}. Learn how we collect, use, and protect your personal information.`}
        descriptionAr={`سياسة الخصوصية لشركة ${company}. تعرف على كيفية جمع واستخدام وحماية معلوماتك الشخصية.`}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-text mb-8">{t('privacy.title')}</h1>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 space-y-6 text-sm text-text-muted leading-relaxed">
          {lastUpdated && (
            <p className="text-xs text-text-muted">
              {lang === 'ar' ? 'آخر تحديث:' : 'Last updated:'} {lastUpdated}
            </p>
          )}

          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-text mb-2">{section.title}</h2>
              <p className="whitespace-pre-line">{section.content}</p>
            </section>
          ))}

          {/* Fallback contact info */}
          {sections.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <p className="font-medium text-text">
                {company}<br />
                {lang === 'ar' ? 'البريد الإلكتروني:' : 'Email:'} {email}<br />
                {lang === 'ar' ? 'الهاتف:' : 'Phone:'} {g.phone1 || '+201018559479'}{g.phone2 ? ` / ${g.phone2}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
