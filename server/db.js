import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_PERMISSIONS } from './permissions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'data.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

export function initDb() {
  // ---- Core tables (unchanged) ----
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gift_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      UNIQUE(role_id, permission)
    );

    CREATE TABLE IF NOT EXISTS form_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      fields TEXT NOT NULL DEFAULT '[]',
      settings TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS page_content (
      slug TEXT PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL DEFAULT '{}',
      hidden INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT 'Admin',
      status TEXT NOT NULL DEFAULT 'draft',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      response_status INTEGER,
      response_body TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ---- Ensure users table exists (legacy or fresh) ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role_id INTEGER,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ---- Migration: add email and role_id columns if missing ----
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!cols.includes('role_id')) {
    db.exec('ALTER TABLE users ADD COLUMN role_id INTEGER');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');

  // ---- Migration: add hidden, is_custom, title columns to page_content if missing ----
  const pageCols = db.prepare("PRAGMA table_info(page_content)").all().map(c => c.name);
  if (!pageCols.includes('hidden')) {
    db.exec('ALTER TABLE page_content ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
  }
  if (!pageCols.includes('is_custom')) {
    db.exec('ALTER TABLE page_content ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0');
  }
  if (!pageCols.includes('title')) {
    db.exec('ALTER TABLE page_content ADD COLUMN title TEXT');
  }
  if (!pageCols.includes('content_ar')) {
    db.exec("ALTER TABLE page_content ADD COLUMN content_ar TEXT NOT NULL DEFAULT '{}'");
  }

  // ---- Migration: add Arabic columns to products ----
  const prodCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
  if (!prodCols.includes('name_ar')) {
    db.exec("ALTER TABLE products ADD COLUMN name_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE products ADD COLUMN description_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE products ADD COLUMN features_ar TEXT NOT NULL DEFAULT '[]'");
    db.exec("ALTER TABLE products ADD COLUMN branding_options_ar TEXT NOT NULL DEFAULT '[]'");
    db.exec("ALTER TABLE products ADD COLUMN notes_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE products ADD COLUMN price_range_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE products ADD COLUMN lead_time_ar TEXT NOT NULL DEFAULT ''");
  }

  // ---- Migration: add Arabic columns to categories ----
  const catCols = db.prepare("PRAGMA table_info(categories)").all().map(c => c.name);
  if (!catCols.includes('name_ar')) {
    db.exec("ALTER TABLE categories ADD COLUMN name_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE categories ADD COLUMN description_ar TEXT NOT NULL DEFAULT ''");
  }

  // ---- Migration: add Arabic columns to blog_posts ----
  const blogCols = db.prepare("PRAGMA table_info(blog_posts)").all().map(c => c.name);
  if (!blogCols.includes('title_ar')) {
    db.exec("ALTER TABLE blog_posts ADD COLUMN title_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE blog_posts ADD COLUMN excerpt_ar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE blog_posts ADD COLUMN content_ar TEXT NOT NULL DEFAULT ''");
  }

  // ---- Performance indexes ----
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON form_submissions(created_at);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
  `);

  // ---- Seed default roles ----
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (roleCount.count === 0) {
    seedRoles();
    console.log('Seeded default roles (Super Admin, Admin, Editor)');
  }

  // ---- Migration: ensure Admin & Editor roles have up-to-date permissions ----
  migrateRolePermissions();

  // ---- Backfill role_id from old role TEXT column ----
  const needsBackfill = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id IS NULL').get();
  if (needsBackfill.count > 0) {
    backfillRoleIds();
  }

  // ---- Seed default admin user ----
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const superAdminRole = db.prepare("SELECT id FROM roles WHERE slug = 'super_admin'").get();
    // Generate a secure random password for the default admin
    const defaultPassword = crypto.randomBytes(16).toString('base64url');
    const hash = bcrypt.hashSync(defaultPassword, 12);
    db.prepare('INSERT INTO users (username, password_hash, role, role_id) VALUES (?, ?, ?, ?)').run('admin', hash, 'super_admin', superAdminRole.id);
    console.log('═══════════════════════════════════════════════════');
    console.log('  Default super admin user created');
    console.log(`  Username: admin`);
    console.log(`  Password: ${defaultPassword}`);
    console.log('  ⚠️  SAVE THIS PASSWORD — it will NOT be shown again!');
    console.log('═══════════════════════════════════════════════════');
  }

  // ---- Seed categories ----
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCount.count === 0) {
    seedCategories();
    console.log('Seeded product categories');
  }

  // ---- Seed products ----
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (productCount.count === 0) {
    seedProducts();
    console.log('Seeded 20 products into database');
  }

  // ---- Seed gift settings ----
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM gift_settings').get();
  if (settingsCount.count === 0) {
    seedGiftSettings();
    console.log('Seeded gift finder settings');
  }

  // ---- Seed page content ----
  const pageCount = db.prepare('SELECT COUNT(*) as count FROM page_content').get();
  if (pageCount.count === 0) {
    seedPageContent();
    console.log('Seeded page content');
  }

  // ---- Seed default forms ----
  const formCount = db.prepare('SELECT COUNT(*) as count FROM form_definitions').get();
  if (formCount.count === 0) {
    seedForms();
    console.log('Seeded default forms');
  }

  // ---- Migration: insert privacy page if missing ----
  const privacyExists = db.prepare("SELECT slug FROM page_content WHERE slug = 'privacy'").get();
  if (!privacyExists) {
    const privacyEn = {
      lastUpdated: 'February 2026',
      sections: [
        { title: '1. Information We Collect', content: 'When you submit a quote request or contact us, we collect personal information such as your name, email address, phone number, and company name. We also collect information about your project requirements including product preferences, quantity, and budget.' },
        { title: '2. How We Use Your Information', content: 'We use the information you provide to respond to your inquiries and quote requests, provide and improve our products and services, communicate with you about your orders and projects, and send relevant marketing communications (with your consent).' },
        { title: '3. Data Sharing', content: 'We do not sell, trade, or rent your personal information to third parties. We may share your data with trusted service providers who assist us in operating our business, provided they agree to keep this information confidential.' },
        { title: '4. Data Security', content: 'We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.' },
        { title: '5. Cookies', content: 'Our website may use cookies to enhance your browsing experience. You can choose to disable cookies through your browser settings, though this may affect some functionality.' },
        { title: '6. Your Rights', content: 'You have the right to access, correct, or delete your personal information at any time. To exercise these rights, please contact us.' },
        { title: '7. Contact', content: 'If you have questions about this privacy policy, please contact us via email or phone.' },
      ],
    };
    const privacyAr = {
      lastUpdated: 'فبراير 2026',
      sections: [
        { title: '١. المعلومات التي نجمعها', content: 'عندما تقدم طلب عرض سعر أو تتواصل معنا، نجمع معلومات شخصية مثل اسمك وعنوان بريدك الإلكتروني ورقم هاتفك واسم شركتك. كما نجمع معلومات حول متطلبات مشروعك بما في ذلك تفضيلات المنتج والكمية والميزانية.' },
        { title: '٢. كيف نستخدم معلوماتك', content: 'نستخدم المعلومات التي تقدمها للرد على استفساراتك وطلبات عروض الأسعار، وتقديم منتجاتنا وخدماتنا وتحسينها، والتواصل معك بشأن طلباتك ومشاريعك، وإرسال اتصالات تسويقية ذات صلة (بموافقتك).' },
        { title: '٣. مشاركة البيانات', content: 'لا نبيع معلوماتك الشخصية أو نتاجر بها أو نؤجرها لأطراف ثالثة. قد نشارك بياناتك مع مزودي الخدمة الموثوق بهم الذين يساعدوننا في تشغيل أعمالنا، شريطة موافقتهم على الحفاظ على سرية هذه المعلومات.' },
        { title: '٤. أمان البيانات', content: 'نطبق تدابير تقنية وتنظيمية مناسبة لحماية بياناتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف.' },
        { title: '٥. ملفات تعريف الارتباط', content: 'قد يستخدم موقعنا ملفات تعريف الارتباط لتحسين تجربة التصفح. يمكنك اختيار تعطيل ملفات تعريف الارتباط من خلال إعدادات المتصفح، وإن كان ذلك قد يؤثر على بعض الوظائف.' },
        { title: '٦. حقوقك', content: 'يحق لك الوصول إلى معلوماتك الشخصية أو تصحيحها أو حذفها في أي وقت. لممارسة هذه الحقوق، يرجى التواصل معنا.' },
        { title: '٧. التواصل', content: 'إذا كان لديك أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا عبر البريد الإلكتروني أو الهاتف.' },
      ],
    };
    db.prepare("INSERT INTO page_content (slug, title, content, content_ar) VALUES (?, ?, ?, ?)").run(
      'privacy', 'Privacy Policy', JSON.stringify(privacyEn), JSON.stringify(privacyAr)
    );
    console.log('Inserted privacy page content (EN + AR)');
  }
}

function seedCategories() {
  const insert = db.prepare('INSERT INTO categories (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)');
  const cats = [
    ['3d-printing', '3D Printing', '🖨️', 'Custom 3D printed items shaped as your logo or product', 0],
    ['usb', 'USB & Flash Drives', '💾', 'Custom branded USB flash drives & dual drives', 1],
    ['chargers', 'Chargers & Power Banks', '🔋', 'Wireless chargers, power banks & charging cables', 2],
    ['gift-sets', 'Gift Sets', '🎁', 'Curated corporate gift sets in premium packaging', 3],
    ['notebooks', 'Notebooks & Organizers', '📓', 'Branded notebooks, smart organizers & pen sets', 4],
    ['desk', 'Desk Accessories', '🖊️', 'Desk sets, LED lamps & office accessories', 5],
    ['drinkware', 'Drinkware', '☕', 'Mugs, thermal cups, water bottles & tumblers', 6],
    ['eco', 'Eco-Friendly', '🌿', 'Wheat straw, bamboo & cork sustainable products', 7],
    ['keychains', 'Keychains & Coasters', '🔑', 'Custom rubber keychains & coasters', 8],
    ['awards', 'Awards & Trophies', '🏆', 'Crystal awards & recognition trophies', 9],
    ['bags', 'Bags', '🎒', 'Custom tote bags with branding', 10],
  ];
  const seed = db.transaction(() => { for (const c of cats) insert.run(...c); });
  seed();
}

function seedRoles() {
  const insertRole = db.prepare('INSERT INTO roles (name, slug, is_system) VALUES (?, ?, ?)');
  const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)');

  const seed = db.transaction(() => {
    // Super Admin — is_system, all permissions implied in code (no rows needed)
    insertRole.run('Super Admin', 'super_admin', 1);

    // Admin — broad access (everything except role management and SMTP)
    const adminResult = insertRole.run('Admin', 'admin', 0);
    const adminPerms = [
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'users.view', 'users.create', 'users.edit',
      'gift_settings.view', 'gift_settings.edit',
      'pages.view', 'pages.edit',
      'forms.view', 'forms.create', 'forms.edit', 'forms.delete',
      'files.upload', 'files.delete',
    ];
    for (const p of adminPerms) insertPerm.run(adminResult.lastInsertRowid, p);

    // Editor — content management only
    const editorResult = insertRole.run('Editor', 'editor', 0);
    const editorPerms = [
      'products.view', 'products.create', 'products.edit',
      'gift_settings.view',
      'pages.view', 'pages.edit',
      'forms.view', 'forms.create', 'forms.edit',
      'files.upload',
    ];
    for (const p of editorPerms) insertPerm.run(editorResult.lastInsertRowid, p);
  });
  seed();
}

function migrateRolePermissions() {
  const adminPerms = [
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'users.view', 'users.create', 'users.edit',
    'gift_settings.view', 'gift_settings.edit',
    'pages.view', 'pages.edit',
    'forms.view', 'forms.create', 'forms.edit', 'forms.delete',
    'files.upload', 'files.delete',
  ];
  const editorPerms = [
    'products.view', 'products.create', 'products.edit',
    'gift_settings.view',
    'pages.view', 'pages.edit',
    'forms.view', 'forms.create', 'forms.edit',
    'files.upload',
  ];

  const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)');
  const migrate = db.transaction(() => {
    const adminRole = db.prepare("SELECT id FROM roles WHERE slug = 'admin'").get();
    const editorRole = db.prepare("SELECT id FROM roles WHERE slug = 'editor'").get();
    if (adminRole) for (const p of adminPerms) insertPerm.run(adminRole.id, p);
    if (editorRole) for (const p of editorPerms) insertPerm.run(editorRole.id, p);
  });
  migrate();
}

function backfillRoleIds() {
  const roleMap = {};
  const roles = db.prepare('SELECT id, slug FROM roles').all();
  for (const r of roles) roleMap[r.slug] = r.id;

  const users = db.prepare('SELECT id, role FROM users WHERE role_id IS NULL').all();
  const update = db.prepare('UPDATE users SET role_id = ? WHERE id = ?');

  const backfill = db.transaction(() => {
    for (const u of users) {
      const roleId = roleMap[u.role] || roleMap['editor'];
      update.run(roleId, u.id);
    }
  });
  backfill();
  console.log(`Backfilled role_id for ${users.length} user(s)`);
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

function seedPageContent() {
  const insert = db.prepare('INSERT INTO page_content (slug, content) VALUES (?, ?)');

  const pages = {
    global: {
      companyName: '3DTech',
      tagline: 'Custom 3D printed promotional products and branded giveaways for every need.',
      email: 'info@3dtecheg.com',
      phone1: '+201018559479',
      phone2: '+201005449959',
      location: 'Cairo, Egypt',
      logoUrl: '/logo.jpeg',
      whyUs: [
        'Free design mockup',
        '24-hour quote turnaround',
        'No hidden fees',
        'Bulk order discounts',
        'Quality guarantee',
      ],
    },
    home: {
      heroBadge: '3D Printing & Corporate Gifts in Egypt',
      heroTitle1: '3D Printing & Premium',
      heroTitle2: 'Corporate Gifts',
      heroDescription: 'At 3DTECH, we turn ideas into real products and help companies deliver customized corporate gifts that clearly and professionally represent their brand.',
      heroCta1: 'Browse Products',
      heroCta2: 'Find the Perfect Gift',
      stats: [
        { value: '500+', label: 'Projects Delivered' },
        { value: '50+', label: 'Corporate Clients' },
        { value: '24hr', label: 'Quote Turnaround' },
        { value: '100%', label: 'Custom Designs' },
      ],
      categoriesTitle: 'Product Categories',
      categoriesDescription: 'Explore our range of customizable 3D-printed promotional products.',
      featuredTitle: 'Featured Products',
      featuredDescription: 'Popular items from our catalog',
      whyTitle: 'Why 3DTECH?',
      whyDescription: 'What sets us apart in the Egyptian market',
      whyReasons: [
        { icon: '🇪🇬', text: 'Practical experience in the Egyptian market' },
        { icon: '💡', text: 'From idea to execution' },
        { icon: '⏰', text: 'Clear commitment to deadlines' },
        { icon: '📦', text: 'Flexible production quantities' },
        { icon: '🤝', text: 'Direct communication and technical support' },
      ],
      processTitle: 'How We Work',
      processSteps: [
        { number: '01', title: 'Receive Your Idea', description: 'We receive your idea or request' },
        { number: '02', title: 'Technical Review', description: 'Specification definition & feasibility' },
        { number: '03', title: '3D Design', description: 'Custom 3D design if required' },
        { number: '04', title: 'Production', description: 'Printing with industrial-grade printers' },
        { number: '05', title: 'Delivery', description: 'Testing, packaging & delivery' },
      ],
      ctaTitle: 'Ready to Make Your Brand Stand Out?',
      ctaDescription: 'Send us your project details or required quantities, and we will respond with a clear quotation shortly.',
      ctaButton: 'Request a Free Quote',
      ctaButton2: 'Explore Our Services',
    },
    about: {
      heroTitle1: 'About',
      heroTitle2: '3DTECH',
      heroDescription: '3DTECH is a company specialized in 3D printing and customized corporate gifts. We have worked across multiple industries including real estate, pharmaceuticals, education, energy, and services. Our goal is simple: Turn ideas into tangible products with clear quality and structured execution.',
      visionTitle: 'Our Vision',
      visionText: 'Our vision at 3DTECH is to empower individuals and companies to transform their ideas into tangible, high-quality products through innovative 3D printing solutions. We aim to be a key partner in product development and customized gifts, with a strong focus on innovation, sustainability, and delivering an exceptional customer experience.',
      missionTitle: 'Our Mission',
      missionText: 'At 3DTECH, we transform ideas into high-quality products delivered with rapid execution to support entrepreneurs and businesses in developing their unique products and customized gifts. Through innovation, sustainability, and a strong customer experience, we provide 3D printing solutions that open new opportunities for growth and excellence in the Egyptian market.',
      valuesTitle: 'Core Values',
      coreValues: [
        { title: 'Customer First', description: 'Respecting customer needs, delivering a distinctive experience, and maintaining high quality with attention to the smallest details that matter to them.', icon: '👤' },
        { title: 'Team Spirit', description: 'Collaboration, mutual respect, and sharing knowledge and experience with both internal teams and freelancers to achieve success together.', icon: '🤝' },
        { title: 'Quality & Precision', description: 'Every product reflects our commitment to quality, precise execution, and design that fulfills the client\'s objective.', icon: '✅' },
        { title: 'Integrity & Commitment', description: 'We honor our promises and respect time and effort — whether with clients or partners.', icon: '🤲' },
        { title: 'Continuous Learning', description: 'Every project is an opportunity to learn and improve.', icon: '📚' },
      ],
      storyStats: [
        { value: '2019', label: 'Founded' },
        { value: '500+', label: 'Projects Completed' },
        { value: '50+', label: 'Active Clients' },
        { value: '10+', label: '3D Printers' },
      ],
      whyTitle: 'Why 3DTECH?',
      whyReasons: [
        'Practical experience in the Egyptian market',
        'From idea to execution',
        'Clear commitment to deadlines',
        'Flexible production quantities',
        'Direct communication and technical support',
      ],
      processTitle: 'How We Work',
      processSteps: [
        { number: '01', title: 'Receive Your Idea', description: 'We receive your idea or request and understand your vision and requirements.' },
        { number: '02', title: 'Technical Review', description: 'Technical review and specification definition to ensure feasibility and quality.' },
        { number: '03', title: '3D Design', description: 'Our team creates a custom 3D design tailored to your requirements.' },
        { number: '04', title: 'Production & Printing', description: 'Once approved, we begin production using industrial-grade 3D printers.' },
        { number: '05', title: 'Testing & Delivery', description: 'Quality-checked products are packaged and delivered to your door.' },
      ],
      ctaTitle: "Let's Create Something Amazing",
      ctaDescription: 'Ready to elevate your brand with custom 3D-printed products? Get started with a free quote.',
      ctaButton: 'Get a Free Quote',
    },
    services: {
      heroBadge: 'What We Do',
      heroTitle1: '3D Printing & Premium',
      heroTitle2: 'Corporate Gifts',
      heroDescription: 'At 3DTECH, we turn ideas into real products and help companies deliver customized corporate gifts that clearly and professionally represent their brand.',
      printingTitle: '3D Printing Services',
      printingDescription: 'Professional 3D printing solutions for engineering, product development, education, and creative projects across Egypt.',
      printingServices: [
        { title: 'Engineering & Architectural Models', description: 'We convert drawings and plans into accurate physical models.', icon: '🏗️', points: ['Ideal for real estate developers and engineering firms', 'Helps present projects before execution', 'Supports decision-making for clients and investors', 'Produced according to required scale and specifications'] },
        { title: 'Product Prototyping', description: 'Turn your product idea into a functional prototype before manufacturing.', icon: '⚙️', points: ['Test shape and size before production', 'Suitable for startups and factories', 'Fast iteration based on feedback'] },
        { title: 'Custom Mechanical Parts', description: 'Design and print parts based on required dimensions.', icon: '🔧', points: ['Practical solution for unavailable spare parts', 'Suitable for maintenance and limited production', 'Ability to test performance before scaling'] },
        { title: 'Graduation Projects & Educational Models', description: 'Technical support to transform student ideas into professional models.', icon: '🎓', points: ['Suitable for engineering, arts, and architecture students', 'On-time delivery with clear quality standards', 'Technical guidance during execution'] },
        { title: 'Decorative & Artistic Pieces', description: 'Custom-designed decorative items for offices and exhibitions.', icon: '🎨', points: ['Fully customized designs', 'Suitable for branding or internal use', 'Adds strong visual value'] },
      ],
      giftsTitle: 'Corporate Gifts & Custom Giveaways',
      giftsDescription: 'Customized promotional products and branded giveaways designed to represent your company with quality and professionalism.',
      giftServices: [
        { title: 'Year-End Corporate Gifts', description: 'Customized gifts branded with your company logo.', icon: '🎁', points: ['Ideal for clients and teams', 'Options based on budget and quantity', 'Ready-to-distribute packaging'] },
        { title: 'Employee Gifts & Welcome Kits', description: 'Practical products for daily use.', icon: '👋', points: ['Suitable for new employees and engagement campaigns', 'Full branded packages available', 'Organized and professional delivery'] },
        { title: 'Event & Exhibition Giveaways', description: 'Lightweight promotional items for events.', icon: '🎪', points: ['Designed to reflect your brand identity', 'Bulk production with clear timelines', 'Ideal for direct marketing'] },
        { title: 'Awards & Recognition Gifts', description: 'Custom-designed trophies and awards.', icon: '🏆', points: ['Suitable for companies, universities, and institutions', 'Designed to reflect the value of the occasion', 'High-quality finishing and presentation'] },
        { title: 'Seasonal Corporate Gifts', description: 'Gifts tailored for occasions such as Ramadan or New Year.', icon: '🌙', points: ['Can combine 3D printing with traditional products', 'Designed based on your audience', 'Helps maintain strong client relationships'] },
      ],
      ctaTitle: 'Ready to Get Started?',
      ctaDescription: 'Send us your project details or required quantities, and we will respond with a clear quotation shortly.',
      ctaButton1: 'Request a Quote',
      ctaButton2: 'Browse Products',
    },
    contact: {
      title: 'Request a Quote',
      description: "Tell us about your project and we'll prepare a custom quote for you.",
      successTitle: 'Quote Request Sent!',
      successMessage: "Thank you, {name}. We've received your request and will get back to you within 24 hours.",
      successButton: 'Submit Another Request',
      submitButton: 'Submit Quote Request',
    },
    products: {
      title: 'Product Catalog',
      description: 'Browse our full range of customizable 3D-printed products',
      searchPlaceholder: 'Search products...',
      noResultsTitle: 'No products found',
      noResultsDescription: 'Try adjusting your search or filter criteria',
    },
  };

  const seed = db.transaction(() => {
    for (const [slug, content] of Object.entries(pages)) {
      insert.run(slug, JSON.stringify(content));
    }
  });
  seed();
}

function seedForms() {
  const quoteFields = [
    { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your full name' },
    { name: 'company', label: 'Company', type: 'text', required: false, placeholder: 'Company name (optional)' },
    { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@company.com' },
    { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '+20 xxx xxx xxxx' },
    { name: 'giftType', label: 'Gift Type', type: 'select', required: false, options: ['Corporate Event', 'Trade Show / Expo', 'Employee Appreciation', 'Client Gift', 'Product Launch', 'Holiday / Seasonal', 'Wedding / Party Favor', 'Other'] },
    { name: 'product', label: 'Product Interest', type: 'text', required: false, placeholder: 'Specific product (if any)' },
    { name: 'quantity', label: 'Estimated Quantity', type: 'text', required: false, placeholder: 'e.g. 100-500 units' },
    { name: 'budget', label: 'Budget Range', type: 'text', required: false, placeholder: 'e.g. EGP 50-100 per unit' },
    { name: 'deliveryDate', label: 'Desired Delivery Date', type: 'date', required: false },
    { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false, placeholder: 'Tell us about your project...' },
  ];

  const settings = { successTitle: 'Quote Request Sent!', successMessage: "Thank you! We've received your request and will get back to you within 24 hours.", submitButton: 'Submit Quote Request' };

  db.prepare("INSERT INTO form_definitions (name, slug, description, fields, settings) VALUES (?, ?, ?, ?, ?)").run(
    'Quote Request',
    'quote-request',
    'Request a custom quote for promotional products',
    JSON.stringify(quoteFields),
    JSON.stringify(settings)
  );
}

export default db;
