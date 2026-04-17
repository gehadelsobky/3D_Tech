#!/usr/bin/env node
/**
 * export-seed.js
 * يعمل export من الـ database المحلي ويحفظه في scripts/seed-data.json
 * شغّله مرة واحدة من جهازك:  node scripts/export-seed.js
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../server/data.db'));

// الجداول اللي هنعمل لها export (بدون users و api_keys و webhooks)
const TABLES = [
  'categories',
  'products',
  'page_content',
  'blog_posts',
  'app_settings',
  'form_definitions',
  'gift_settings',
  'roles',
  'role_permissions',
];

const seed = {};
for (const table of TABLES) {
  try {
    seed[table] = db.prepare(`SELECT * FROM ${table}`).all();
    console.log(`✅ ${table}: ${seed[table].length} rows`);
  } catch (e) {
    console.log(`⚠️  ${table}: skipped (${e.message})`);
    seed[table] = [];
  }
}

const outputPath = join(__dirname, 'seed-data.json');
writeFileSync(outputPath, JSON.stringify(seed, null, 2), 'utf-8');
console.log(`\n✅ Exported to scripts/seed-data.json`);
