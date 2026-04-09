import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'data.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      features TEXT NOT NULL DEFAULT '[]',
      branding_options TEXT NOT NULL DEFAULT '[]',
      moq INTEGER NOT NULL DEFAULT 50,
      lead_time TEXT NOT NULL DEFAULT '',
      price_range TEXT NOT NULL DEFAULT '',
      price_min REAL,
      price_max REAL,
      lead_days INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gift_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Auto-seed if tables are empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Default admin user created (username: admin, password: admin123)');
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (productCount.count === 0) {
    seedProducts();
    console.log('Seeded 20 products into database');
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM gift_settings').get();
  if (settingsCount.count === 0) {
    seedGiftSettings();
    console.log('Seeded gift finder settings');
  }
}

function seedProducts() {
  const insert = db.prepare(`
    INSERT INTO products (id, name, category, images, description, features, branding_options, moq, lead_time, price_range, price_min, price_max, lead_days, tags, notes)
    VALUES (@id, @name, @category, @images, @description, @features, @branding_options, @moq, @lead_time, @price_range, @price_min, @price_max, @lead_days, @tags, @notes)
  `);

  const products = [
    { id: 1, name: 'Customized USB Drive', category: 'usb', images: JSON.stringify(['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1618410320928-25228d811631?w=600&h=400&fit=crop']), description: 'Customized USB with any shape as per your logo or product. Fully 3D printed custom shell in any design you need.', features: JSON.stringify(['Custom 3D printed shape','Any logo or product shape','Multiple storage capacities','Durable material']), branding_options: JSON.stringify(['Full 3D custom shape','Logo molding','Custom color matching']), moq: 150, lead_time: '30-40 business days', price_range: 'EGP 290 - EGP 350 per unit', price_min: 290, price_max: 350, lead_days: 40, tags: JSON.stringify(['tech','corporate','practical']), notes: 'Quantity range 150-500 pieces. Price varies by quantity.' },
    { id: 2, name: 'Hook Flash Memory 32GB', category: 'usb', images: JSON.stringify(['https://images.unsplash.com/photo-1618410320928-25228d811631?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=400&fit=crop']), description: 'Premium metal hook flash memory drive with 32GB storage. Compact and durable design with a convenient hook clip for keychains or bags.', features: JSON.stringify(['32GB storage','Metal construction','Hook clip design','USB 3.0']), branding_options: JSON.stringify(['Laser engraving','Logo print','Custom packaging']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 375 per unit', price_min: 375, price_max: 375, lead_days: 21, tags: JSON.stringify(['tech','corporate','compact']), notes: 'Also available: Metal Flash memory with light-up logo 16G at EGP 350' },
    { id: 3, name: 'Customized Wireless Charger', category: 'chargers', images: JSON.stringify(['https://images.unsplash.com/photo-1622675272076-53ccb779cfc4?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=400&fit=crop']), description: 'Customized wireless charger for smart phones. Fully custom-shaped to match your brand logo or product design.', features: JSON.stringify(['Custom 3D shape','Qi wireless charging','Compatible with all smartphones','LED indicator']), branding_options: JSON.stringify(['Full 3D custom shape','Logo molding','Custom color']), moq: 200, lead_time: '60-90 business days', price_range: 'EGP 710 - EGP 750 per unit', price_min: 710, price_max: 750, lead_days: 90, tags: JSON.stringify(['tech','premium','unique']), notes: 'Custom shape based on your logo or product design' },
    { id: 4, name: 'Magnetic Wireless Power Bank 10000mAh', category: 'chargers', images: JSON.stringify(['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&h=400&fit=crop']), description: 'Magnetic wireless power bank with charging indicator and 10000mAh capacity. MagSafe compatible with light-up logo option.', features: JSON.stringify(['10000mAh capacity','Magnetic wireless charging','MagSafe compatible','Charging indicator LED']), branding_options: JSON.stringify(['Light-up logo','Laser engraving','UV color print']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 930 - EGP 970 per unit', price_min: 930, price_max: 970, lead_days: 21, tags: JSON.stringify(['tech','premium','practical']), notes: 'Available with wireless light-up logo. MagSafe version also available.' },
    { id: 5, name: 'Multi-Cable Charging Set', category: 'chargers', images: JSON.stringify(['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1622675272076-53ccb779cfc4?w=600&h=400&fit=crop']), description: 'Multi-cable set with charging cables for all your essential connections: Type C, Lightning, Micro USB and USB. Compact round case design.', features: JSON.stringify(['Type C cable','Lightning cable','Micro USB cable','Compact round case']), branding_options: JSON.stringify(['Logo print on case','Custom case color','Branded packaging']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 395 per unit', price_min: 395, price_max: 395, lead_days: 21, tags: JSON.stringify(['tech','practical','corporate']), notes: 'All-in-one charging solution in a compact carrying case' },
    { id: 6, name: 'Customized Multi Charger Cable', category: 'chargers', images: JSON.stringify(['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=400&fit=crop']), description: 'Customized multi charger cable with 3D printed custom-shaped connector hub. Combine your brand identity with everyday utility.', features: JSON.stringify(['Custom 3D printed shape','Multiple connector types','Fast charging','Durable cable']), branding_options: JSON.stringify(['Full 3D custom shape','Logo molding','Custom color']), moq: 400, lead_time: '30-40 business days', price_range: 'EGP 365 - EGP 399 per unit', price_min: 365, price_max: 399, lead_days: 40, tags: JSON.stringify(['tech','practical','bulk']), notes: 'Customized shape as per your brand logo' },
    { id: 7, name: 'Customized Rubber Keychain', category: 'keychains', images: JSON.stringify(['https://images.unsplash.com/photo-1622434641406-a158123450f9?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1584735174914-ddeca2b474e7?w=600&h=400&fit=crop']), description: 'Customized rubber keychain made in any shape matching your brand logo, mascot, or product. High-quality PVC rubber with vibrant colors.', features: JSON.stringify(['Custom shape design','PVC rubber material','Vibrant colors','Lightweight & durable']), branding_options: JSON.stringify(['Full custom shape','Multi-color printing','Single or double sided']), moq: 500, lead_time: '30-40 business days', price_range: 'EGP 29 - EGP 35 per unit', price_min: 29, price_max: 35, lead_days: 40, tags: JSON.stringify(['fun','budget','bulk']), notes: 'Price is for single side. Double side available at additional cost.' },
    { id: 8, name: 'Customized Rubber Coasters', category: 'keychains', images: JSON.stringify(['https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1622434641406-a158123450f9?w=600&h=400&fit=crop']), description: 'Customized rubber coasters with any shape. Perfect for corporate gifting, restaurants, cafes, and promotional events.', features: JSON.stringify(['Custom shape design','Non-slip base','Water resistant','Vibrant color printing']), branding_options: JSON.stringify(['Full custom shape','Multi-color design','Custom packaging']), moq: 500, lead_time: '30-35 business days', price_range: 'EGP 38 - EGP 45 per unit', price_min: 38, price_max: 45, lead_days: 35, tags: JSON.stringify(['fun','budget','bulk']), notes: 'Customized coaster with any shape' },
    { id: 9, name: 'Notebook & Pen Gift Set', category: 'gift-sets', images: JSON.stringify(['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=400&fit=crop']), description: 'Elegant notebook and metal pen set in a premium gift bag. Available in multiple configurations with leather-bound notebook and quality metal pen.', features: JSON.stringify(['A5 leather notebook','Metal pen','Premium gift bag','Multiple color options']), branding_options: JSON.stringify(['Logo debossing','Pen engraving','Custom gift bag']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 175 - EGP 300 per unit', price_min: 175, price_max: 300, lead_days: 21, tags: JSON.stringify(['corporate','gift','premium']), notes: 'Multiple configurations available. EGP 175 for basic set, EGP 300 for premium leather set.' },
    { id: 10, name: 'Premium Laptop Bag Gift Set', category: 'gift-sets', images: JSON.stringify(['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop']), description: 'Premium gift set featuring a laptop bag, notebook, and pen. Perfect for corporate onboarding, executive gifts, and VIP clients.', features: JSON.stringify(['Laptop bag','A5 notebook','Metal pen','Gift bag packaging']), branding_options: JSON.stringify(['Logo embroidery on bag','Notebook debossing','Pen engraving']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 349 - EGP 479 per unit', price_min: 349, price_max: 479, lead_days: 21, tags: JSON.stringify(['premium','corporate','gift']), notes: 'EGP 349 for notebook + pen + bag set. EGP 479 includes laptop sleeve.' },
    { id: 11, name: 'Black Office Essentials Set', category: 'gift-sets', images: JSON.stringify(['https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop']), description: 'Complete black office essentials set including mug, USB drive, pen, notebook, and gift bag. A sophisticated all-in-one corporate gift.', features: JSON.stringify(['Ceramic mug','USB flash drive','Metal pen','Notebook','Premium gift bag']), branding_options: JSON.stringify(['Logo on all items','Custom color theme','Branded gift bag']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 599 per unit', price_min: 599, price_max: 599, lead_days: 21, tags: JSON.stringify(['premium','corporate','gift']), notes: 'Complete office essentials in a cohesive black theme' },
    { id: 12, name: 'A5 Smart Organizer with Wireless Charger', category: 'notebooks', images: JSON.stringify(['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=400&fit=crop']), description: 'A5 smart organizer with built-in wireless charger, 6000mAh power bank, folding mini workstation, notebook, card holder, USB 16GB, magnetic clasp and pen loop.', features: JSON.stringify(['Wireless charger built-in','6000mAh power bank','USB 16GB included','Card holder & pen loop','Folding workstation']), branding_options: JSON.stringify(['Logo debossing','Custom color','Branded packaging']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 1465 per unit', price_min: 1465, price_max: 1465, lead_days: 21, tags: JSON.stringify(['tech','premium','corporate']), notes: 'All-in-one smart organizer with wireless charging and power bank' },
    { id: 13, name: 'A5 Notebook with USB 32GB', category: 'notebooks', images: JSON.stringify(['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=400&fit=crop']), description: 'A5 notebook with elastic band closure and integrated USB 32GB flash drive. Available in black and navy blue colors.', features: JSON.stringify(['A5 size notebook','Elastic band closure','USB 32GB integrated','Available in black & navy blue']), branding_options: JSON.stringify(['Logo debossing','Custom color band','Branded USB']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 625 per unit', price_min: 625, price_max: 625, lead_days: 21, tags: JSON.stringify(['tech','corporate','practical']), notes: 'Available in black and navy blue colors' },
    { id: 14, name: 'Cork & Leather A5 Notebook Set', category: 'eco', images: JSON.stringify(['https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop']), description: 'Eco-friendly set of cork and leather A5 notebook with bamboo pen in a gift box. Made from natural cork, cotton, and wheat straw fibre.', features: JSON.stringify(['Natural cork cover','Bamboo pen included','Gift box packaging','Eco-friendly materials']), branding_options: JSON.stringify(['Logo debossing','Custom band color','Branded gift box']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 260 - EGP 525 per unit', price_min: 260, price_max: 525, lead_days: 21, tags: JSON.stringify(['eco','corporate','gift']), notes: 'EGP 260 for cork x leather set. EGP 525 for cork fabric hard cover set with pen.' },
    { id: 15, name: 'LED Desk Lamp with Wireless Charger', category: 'desk', images: JSON.stringify(['https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=400&fit=crop']), description: 'LED desk lamp with adjustable bracket, cell phone holder, touch control, 10W fast charging wireless charger, 3 brightness levels and eye-caring night light.', features: JSON.stringify(['10W wireless charger','Adjustable bracket','Touch control','3 brightness levels','Phone holder']), branding_options: JSON.stringify(['Logo print on base','Custom packaging','Branded gift box']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 930 per unit', price_min: 930, price_max: 930, lead_days: 21, tags: JSON.stringify(['tech','premium','desk']), notes: 'Also available: LED Desk Lamp with 4000mAh battery at EGP 1200' },
    { id: 16, name: 'Wireless Charger Digital Alarm Clock', category: 'desk', images: JSON.stringify(['https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=600&h=400&fit=crop']), description: 'Wireless charger digital alarm clock with foldable mobile stand, pen holder and 2 USB ports. A multifunctional desk companion.', features: JSON.stringify(['Wireless charger','Digital alarm clock','Foldable phone stand','Pen holder','2 USB ports']), branding_options: JSON.stringify(['Logo print','Custom packaging','Branded display']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 1075 per unit', price_min: 1075, price_max: 1075, lead_days: 21, tags: JSON.stringify(['tech','premium','desk']), notes: 'All-in-one desk organizer with wireless charging and alarm clock' },
    { id: 17, name: 'Wheat Straw Eco Suction Mug 350ml', category: 'drinkware', images: JSON.stringify(['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&h=400&fit=crop']), description: 'Eco-friendly wheat straw suction mug with 350ml capacity. Anti-spill suction base keeps it stable on your desk.', features: JSON.stringify(['350ml capacity','Suction base anti-spill','Wheat straw material','BPA-free','Spill-proof lid']), branding_options: JSON.stringify(['Logo print','Custom color','Branded sleeve']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 610 per unit', price_min: 610, price_max: 610, lead_days: 21, tags: JSON.stringify(['eco','practical','corporate']), notes: 'Made from sustainable wheat straw material' },
    { id: 18, name: 'Bottom Suction Thermal Mug 340ml', category: 'drinkware', images: JSON.stringify(['https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=400&fit=crop']), description: 'Stainless steel thermal mug with bottom suction technology. Keeps drinks hot or cold while staying firmly in place on any surface.', features: JSON.stringify(['340ml capacity','Stainless steel','Bottom suction','Temperature retention','Spill-proof lid']), branding_options: JSON.stringify(['Laser engraving','Logo print','Custom color']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 498 per unit', price_min: 498, price_max: 498, lead_days: 21, tags: JSON.stringify(['premium','practical','corporate']), notes: 'Also available: Stainless Steel Travel Mug 200ml at EGP 480' },
    { id: 19, name: 'Crystal Award Trophies', category: 'awards', images: JSON.stringify(['https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=600&h=400&fit=crop']), description: 'Premium crystal award trophies available in shield and star designs. Perfect for corporate recognition, employee awards, and special events.', features: JSON.stringify(['Premium crystal material','Black base','Multiple designs available','Gift box included']), branding_options: JSON.stringify(['Laser engraving','Custom text','Logo etching']), moq: 25, lead_time: '14-21 business days', price_range: 'EGP 675 - EGP 770 per unit', price_min: 675, price_max: 770, lead_days: 21, tags: JSON.stringify(['premium','corporate','event']), notes: 'Shield design EGP 675, Star design EGP 770. Custom shapes available on request.' },
    { id: 20, name: 'Custom Tote Bag', category: 'bags', images: JSON.stringify(['https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=400&fit=crop','https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=600&h=400&fit=crop']), description: 'Custom printed tote bags with your logo, text, or design. Available in multiple colors and sizes for events, conferences, and promotions.', features: JSON.stringify(['Custom printing','Multiple colors','Durable fabric','Reinforced handles']), branding_options: JSON.stringify(['Screen print','Heat transfer','Full color print']), moq: 50, lead_time: '14-21 business days', price_range: 'Contact for pricing', price_min: 50, price_max: 150, lead_days: 21, tags: JSON.stringify(['event','bulk','corporate']), notes: 'Price varies by size, material, and print complexity. Minimum order 50 units.' },
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });
  insertMany(products);
}

function seedGiftSettings() {
  const defaultSettings = {
    giftTypes: [
      'Corporate Event',
      'Trade Show / Expo',
      'Employee Appreciation',
      'Client Gift',
      'Product Launch',
      'Holiday / Seasonal',
      'Wedding / Party Favor',
      'Other',
    ],
    budgetRanges: [
      { label: 'Under EGP 100 per unit', min: 0, max: 100 },
      { label: 'EGP 100 - EGP 500 per unit', min: 100, max: 500 },
      { label: 'EGP 500 - EGP 1000 per unit', min: 500, max: 1000 },
      { label: 'EGP 1000+ per unit', min: 1000, max: 999999 },
    ],
    audienceTypes: [
      'Corporate / B2B',
      'General Public',
      'Students / Education',
      'Tech Enthusiasts',
      'Employees / Internal',
    ],
    quantityRanges: [
      '20 - 50 units',
      '50 - 100 units',
      '100 - 500 units',
      '500+ units',
    ],
    deliveryTimeframes: [
      { label: 'Within 1 week', days: 7 },
      { label: '1-2 weeks', days: 14 },
      { label: '2-4 weeks', days: 28 },
      { label: '1 month+', days: 999999 },
    ],
    audienceCategoryMap: {
      'Tech Enthusiasts': ['usb', 'chargers', 'desk', 'notebooks'],
      'Corporate / B2B': ['desk', 'usb', 'bags', 'gift-sets', 'awards', 'notebooks'],
      'General Public': ['keychains', 'drinkware', 'bags', 'eco'],
      'Students / Education': ['keychains', 'bags', 'usb', 'notebooks'],
      'Employees / Internal': ['drinkware', 'desk', 'bags', 'gift-sets', 'awards'],
    },
    giftTagMap: {
      'Corporate Event': ['corporate', 'premium', 'event'],
      'Trade Show / Expo': ['bulk', 'budget', 'practical', 'event'],
      'Employee Appreciation': ['premium', 'gift', 'practical', 'desk'],
      'Client Gift': ['premium', 'corporate', 'unique', 'gift'],
      'Product Launch': ['tech', 'unique', 'premium'],
      'Holiday / Seasonal': ['gift', 'fun', 'eco'],
      'Wedding / Party Favor': ['fun', 'budget', 'bulk'],
      'Other': [],
    },
  };
  db.prepare('INSERT INTO gift_settings (id, settings) VALUES (1, ?)').run(JSON.stringify(defaultSettings));
}

export default db;
