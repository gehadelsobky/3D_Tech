import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="mb-4">
              <img src="/logo.jpeg" alt="3D Tech" className="h-10 w-auto" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Custom 3D printed promotional products and branded giveaways for every need.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Products</h4>
            <ul className="space-y-2 list-none p-0 m-0">
              <li><Link to="/products?cat=usb" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">USB Drives</Link></li>
              <li><Link to="/products?cat=chargers" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Chargers</Link></li>
              <li><Link to="/products?cat=keychains" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Keychains</Link></li>
              <li><Link to="/products?cat=desk" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Desk Accessories</Link></li>
              <li><Link to="/products?cat=mugs" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Mugs</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Company</h4>
            <ul className="space-y-2 list-none p-0 m-0">
              <li><Link to="/about" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">About Us</Link></li>
              <li><Link to="/gift-finder" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Gift Finder</Link></li>
              <li><Link to="/contact" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Contact</Link></li>
              <li><Link to="/privacy" className="text-sm text-gray-400 hover:text-white no-underline transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Get In Touch</h4>
            <ul className="space-y-2 list-none p-0 m-0 text-sm text-gray-400">
              <li>info@3dtecheg.com</li>
              <li>+201018559479</li>
              <li>+201005449959</li>

            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} 3DTech. All rights reserved.</p>
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
