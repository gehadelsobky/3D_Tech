#!/usr/bin/env node
/**
 * import-seed.js
 * يقرأ scripts/seed-data.json ويحطه في الـ database على السيرفر
 * شغّله على السيرفر:  node scripts/import-seed.js
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'seed-data.json');

if (!existsSync(seedPath)) {
  console.error('❌ seed-data.json مش موجود — شغّل export-seed.js الأول على جهازك');
  process.exit(1);
}

const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
const db = new Database(join(__dirname, '../server/data.db'));

// ترتيب الاستيراد (الـ FK dependencies)
const ORDER = [
  'roles',
  'role_permissions',
  'categories',
  'products',
  'page_content',
  'blog_posts',
  'app_settings',
  'form_definitions',
  'gift_settings',
];

db.exec('PRAGMA foreign_keys = OFF;');

const importTable = db.transaction((table, rows) => {
  if (!rows || rows.length === 0) return 0;

  // امسح البيانات الموجودة (بس مش users)
  db.prepare(`DELETE FROM ${table}`).run();

  // استورد الصفوف
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
  );

  let count = 0;
  for (const row of rows) {
    try {
      stmt.run(Object.values(row));
      count++;
    } catch (e) {
      console.warn(`  ⚠️  Row skipped in ${table}: ${e.message}`);
    }
  }
  return count;
});

console.log('🚀 بدء الاستيراد...\n');
for (const table of ORDER) {
  if (seed[table]) {
    try {
      const count = importTable(table, seed[table]);
      console.log(`✅ ${table}: ${count} rows imported`);
    } catch (e) {
      console.error(`❌ ${table}: ${e.message}`);
    }
  }
}

db.exec('PRAGMA foreign_keys = ON;');
console.log('\n✅ تم الاستيراد بنجاح! أعد تشغيل السيرفر: pm2 restart 3dtech');
