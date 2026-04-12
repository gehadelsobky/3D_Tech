import { useParams } from 'react-router-dom';
import FormRenderer from '../components/FormRenderer';
import SEO from '../components/SEO';

export default function FormPage() {
  const { slug } = useParams();

  return (
    <main className="bg-surface min-h-screen">
      <SEO title={slug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
          <FormRenderer slug={slug} />
        </div>
      </div>
    </main>
  );
}
