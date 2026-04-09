import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePageContent } from '../context/PageContentContext';

export default function Footer() {
  const { global: g, pagesMeta } = usePageContent();
  const hiddenSlugs = useMemo(() => new Set((pagesMeta || []).filter(p => p.hidden).map(p => p.slug)), [pagesMeta]);
  const customPages = (pagesMeta || []).filter((p) => p.is_custom && !p.hidden);

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="mb-4">
              <img src={g.logoUrl || '/logo.jpeg'} alt={g.companyName || '3D Tech'} className="h-10 w-auto" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {g.tagline || 'Custom 3D printed promotional products and branded giveaways for every need.'}
            </p>
          </div>

          {!hiddenSlugs.has('products') && (
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Products</h4>
            <ul className="space-y-2 list-none p-0 m-0">
              <li><Link to="/products?cat=usb" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">USB Drives</Link></li>
              <li><Link to="/products?cat=chargers" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Chargers</Link></li>
              <li><Link to="/products?cat=keychains" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Keychains</Link></li>
              <li><Link to="/products?cat=desk" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Desk Accessories</Link></li>
              <li><Link to="/products?cat=drinkware" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Drinkware</Link></li>
            </ul>
          </div>
          )}

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Company</h4>
            <ul className="space-y-2 list-none p-0 m-0">
              {!hiddenSlugs.has('about') && <li><Link to="/about" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">About Us</Link></li>}
              <li><Link to="/gift-finder" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Gift Finder</Link></li>
              {!hiddenSlugs.has('contact') && <li><Link to="/contact" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Contact</Link></li>}
              <li><Link to="/privacy" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Privacy Policy</Link></li>
              {customPages.map((p) => (
                <li key={p.slug}><Link to={`/page/${p.slug}`} className="text-sm text-gray-400 hover:text-white no-underline transition-colors">{p.title || p.slug}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Get In Touch</h4>
            <ul className="space-y-2 list-none p-0 m-0 text-sm text-gray-400">
              <li>{g.email || 'info@3dtecheg.com'}</li>
              <li>{g.phone1 || '+201018559479'}</li>
              {g.phone2 && <li>{g.phone2}</li>}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} {g.companyName || '3DTech'}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="text-xs text-gray-500 hover:text-gray-300 no-underline transition-colors">Privacy</Link>
            <span className="text-gray-700">|</span>
            <Link to="/contact" className="text-xs text-gray-500 hover:text-gray-300 no-underline transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
