import { useLanguage } from '../context/LanguageContext';

export default function ClientsMarquee({ clients = [], title, titleAr }) {
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';

  if (!clients || clients.length === 0) return null;

  const displayTitle = (isAr && titleAr) ? titleAr : (title || t('home.clientsTitle'));

  // Duplicate enough times to fill screen seamlessly
  const repeated = clients.length < 6
    ? [...clients, ...clients, ...clients, ...clients]
    : [...clients, ...clients];

  return (
    <section className="py-10 bg-white border-y border-gray-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-3xl font-bold text-text text-center mb-3">
          {displayTitle}
        </h2>
      </div>

      {/* Marquee track */}
      <div
        className="relative flex"
        style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)' }}
      >
        <div className="flex animate-marquee gap-12 items-center">
          {repeated.map((client, i) => (
            <ClientLogo key={i} client={client} isAr={isAr} />
          ))}
        </div>
        {/* Second copy for seamless loop */}
        <div className="flex animate-marquee gap-12 items-center" aria-hidden="true">
          {repeated.map((client, i) => (
            <ClientLogo key={`dup-${i}`} client={client} isAr={isAr} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ClientLogo({ client, isAr }) {
  const displayName = (isAr && client.nameAr) ? client.nameAr : client.name;

  if (client.logoUrl) {
    return (
      <div
        className="shrink-0 flex items-center justify-center h-12 px-4 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
        title={displayName}
      >
        <img
          src={client.logoUrl}
          alt={displayName || 'Client logo'}
          className="h-10 max-w-[140px] object-contain"
          loading="lazy"
        />
      </div>
    );
  }
  // Text fallback if no logo image
  return (
    <div className="shrink-0 px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-text-muted whitespace-nowrap opacity-60 hover:opacity-100 transition-opacity">
      {displayName}
    </div>
  );
}
