# Product CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin bulk-create products by uploading a CSV, with a downloadable template and a validation report shown before anything is written.

**Architecture:** A pure module (`server/productImport.js`) does parsing, validation, and template generation with no HTTP or database access, so it is testable on its own. A thin route module exposes three endpoints. Import is two-step and stateless: preview returns a report and writes nothing; confirm re-uploads the same file, re-validates it from scratch, and inserts inside one transaction. No schema change.

**Tech Stack:** Node 20, Express 5, better-sqlite3, papaparse 5.7 (zero transitive deps), React 19, Tailwind 4. Tests run on Node's built-in runner (`node --test`) — no test framework is added.

**Spec:** `docs/superpowers/specs/2026-09-03-product-csv-import-design.md`

## Global Constraints

- **Insert only.** No task may add an update or delete path through import.
- **No schema change.** The `products` table is not altered.
- **Do not modify** `server/routes/products.js` or `server/routes/upload.js`.
- Limits, copied from the spec: **1000 rows**, **5000 characters per cell**, **5 MB per file**.
- List cells are **pipe-separated**; a cell starting with `[` is parsed as JSON.
- Import rejects cells starting with `=` or `@` only. Export escapes `= + - @ \t \r`.
- `images` accepts a `/uploads/...` path or an `https://` URL; nothing else.
- All three endpoints require the `products.create` permission.
- Every user-facing string is added to **both** `src/i18n/en.js` and `src/i18n/ar.js`.
- Run `npm run lint` before each commit; the baseline is **30 problems**. Do not increase it.

---

### Task 1: Test scaffolding and CSV parsing

**Files:**
- Modify: `package.json` (add `papaparse` dependency, add `test` script)
- Create: `server/productImport.js`
- Test: `server/productImport.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `parseCsv(buffer) -> { headers: string[], rows: object[], error: string|null }`, `MAX_ROWS`, `MAX_CELL_LENGTH`

- [ ] **Step 1: Install the dependency and add the test script**

```bash
npm install papaparse@5.7.0
npm pkg set scripts.test="node --test server/*.test.js"
```

- [ ] **Step 2: Write the failing test**

Create `server/productImport.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, MAX_ROWS } from './productImport.js';

const buf = (s) => Buffer.from(s, 'utf8');

test('parses a simple file', () => {
  const r = parseCsv(buf('name,category\nUSB Drive,usb\n'));
  assert.equal(r.error, null);
  assert.deepEqual(r.headers, ['name', 'category']);
  assert.deepEqual(r.rows, [{ name: 'USB Drive', category: 'usb' }]);
});

test('strips a UTF-8 BOM, as written by this project\'s own export', () => {
  const r = parseCsv(buf('﻿name,category\nUSB,usb\n'));
  assert.deepEqual(r.headers, ['name', 'category']);
});

test('handles quoted cells containing commas and newlines', () => {
  const r = parseCsv(buf('name,description\n"Gift Set","Red, blue\nand green"\n'));
  assert.equal(r.rows[0].description, 'Red, blue\nand green');
});

test('handles escaped double quotes', () => {
  const r = parseCsv(buf('name\n"He said ""hi"""\n'));
  assert.equal(r.rows[0].name, 'He said "hi"');
});

test('normalises header case and surrounding spaces', () => {
  const r = parseCsv(buf(' Name , CATEGORY \nUSB,usb\n'));
  assert.deepEqual(r.headers, ['name', 'category']);
  assert.equal(r.rows[0].name, 'USB');
});

test('skips blank rows', () => {
  const r = parseCsv(buf('name,category\nUSB,usb\n\n,\nMug,drinkware\n'));
  assert.equal(r.rows.length, 2);
});

test('accepts CRLF line endings', () => {
  const r = parseCsv(buf('name,category\r\nUSB,usb\r\n'));
  assert.equal(r.rows.length, 1);
});

test('rejects a file with more than MAX_ROWS rows', () => {
  const body = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `P${i},usb`).join('\n');
  const r = parseCsv(buf(`name,category\n${body}\n`));
  assert.match(r.error, /1000/);
});

test('rejects a file with no data rows', () => {
  const r = parseCsv(buf('name,category\n'));
  assert.match(r.error, /no data rows/i);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './productImport.js'`

- [ ] **Step 4: Write the implementation**

Create `server/productImport.js`:

```js
import Papa from 'papaparse';

/**
 * Pure helpers for the product CSV import. No HTTP, no database — everything
 * here is a function of its arguments, so it can be tested on its own.
 */

export const MAX_ROWS = 1000;
export const MAX_CELL_LENGTH = 5000;

/**
 * Parse an uploaded CSV buffer.
 *
 * Papaparse rather than a hand-rolled split: this project's own export writes
 * quoted cells with a BOM, and cells may legitimately contain commas and
 * newlines. Getting RFC 4180 right by hand is a known trap.
 *
 * @returns {{ headers: string[], rows: object[], error: string|null }}
 */
export function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '');

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const fatal = result.errors.find((e) => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter');
  if (fatal) {
    return { headers: [], rows: [], error: 'File could not be read as CSV. Save it as a comma-separated .csv file.' };
  }

  const headers = (result.meta.fields || []).filter(Boolean);
  if (!headers.length) {
    return { headers: [], rows: [], error: 'File has no header row.' };
  }

  // A row of nothing but empty strings is padding, not data.
  const rows = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  );

  if (!rows.length) {
    return { headers, rows: [], error: 'File has no data rows.' };
  }
  if (rows.length > MAX_ROWS) {
    return { headers, rows: [], error: `File has ${rows.length} rows. The maximum is ${MAX_ROWS}.` };
  }

  return { headers, rows, error: null };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS — 9 tests

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add package.json package-lock.json server/productImport.js server/productImport.test.js
git commit -m "Add CSV parsing for product import

Papaparse rather than a hand-rolled parser: the project's own export
writes quoted cells with a BOM, and product copy legitimately contains
commas and newlines, so a split(',') would fail on this system's own
output.

Tests run on Node's built-in runner, so no test framework is added."
```

---

### Task 2: Column specification and row validation

**Files:**
- Modify: `server/productImport.js`
- Test: `server/productImport.test.js`

**Interfaces:**
- Consumes: `parseCsv`, `MAX_CELL_LENGTH` from Task 1
- Produces:
  - `COLUMNS` — array of `{ name, required, type, max? }`
  - `validateRows(rows, headers, categoryIds, existingNames) -> { valid, errors, warnings, unknownColumns }`
  - `valid[]` entries are objects keyed by **database column name**, ready for INSERT
  - `errors[]` entries are `{ row: number, column: string, value: string, message: string }`
  - `warnings[]` entries are `{ row: number, column: string|null, message: string }`

- [ ] **Step 1: Write the failing tests**

Append to `server/productImport.test.js`:

```js
import { validateRows, COLUMNS } from './productImport.js';

const CATS = ['usb', 'drinkware', 'gift-sets'];
const HEADERS = ['name', 'category'];
const run = (rows, headers = HEADERS, cats = CATS, existing = []) =>
  validateRows(rows, headers, cats, existing);

test('COLUMNS covers exactly the 21 importable fields', () => {
  assert.equal(COLUMNS.length, 21);
  assert.ok(COLUMNS.every((c) => typeof c.name === 'string'));
  const required = COLUMNS.filter((c) => c.required).map((c) => c.name);
  assert.deepEqual(required.sort(), ['category', 'name']);
});

test('accepts a minimal valid row and fills defaults', () => {
  const r = run([{ name: 'USB Drive', category: 'usb' }]);
  assert.equal(r.errors.length, 0);
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].name, 'USB Drive');
  assert.equal(r.valid[0].moq, 50);
  assert.equal(r.valid[0].name_ar, '');
  assert.equal(r.valid[0].tags, '[]');
});

test('rejects a missing required header', () => {
  const r = run([{ category: 'usb' }], ['category']);
  assert.match(r.fileError, /name/);
});

test('rejects an empty name', () => {
  const r = run([{ name: '   ', category: 'usb' }]);
  assert.equal(r.valid.length, 0);
  assert.equal(r.errors[0].column, 'name');
  assert.equal(r.errors[0].row, 2);
});

test('rejects an unknown category and lists the valid ones', () => {
  const r = run([{ name: 'X', category: 'usbb' }]);
  assert.equal(r.errors[0].column, 'category');
  assert.match(r.errors[0].message, /usb/);
});

test('rejects a non-numeric moq', () => {
  const r = run([{ name: 'X', category: 'usb', moq: 'many' }], [...HEADERS, 'moq']);
  assert.equal(r.errors[0].column, 'moq');
});

test('rejects price_max below price_min', () => {
  const r = run(
    [{ name: 'X', category: 'usb', price_min: '90', price_max: '50' }],
    [...HEADERS, 'price_min', 'price_max']
  );
  assert.equal(r.errors[0].column, 'price_max');
  assert.match(r.errors[0].message, /90/);
});

test('rejects a cell that starts a spreadsheet formula', () => {
  const r = run([{ name: '=cmd|calc', category: 'usb' }]);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /formula/i);
});

test('accepts copy that merely starts with a minus or plus', () => {
  const r = run(
    [{ name: '-20% discount bundle', category: 'usb', notes: '+2 year warranty' }],
    [...HEADERS, 'notes']
  );
  assert.equal(r.errors.length, 0);
});

test('parses pipe-separated lists', () => {
  const r = run([{ name: 'X', category: 'usb', tags: 'premium|corporate' }], [...HEADERS, 'tags']);
  assert.equal(r.valid[0].tags, JSON.stringify(['premium', 'corporate']));
});

test('parses a JSON list, so an exported file stays importable', () => {
  const r = run([{ name: 'X', category: 'usb', tags: '["premium","gift"]' }], [...HEADERS, 'tags']);
  assert.equal(r.valid[0].tags, JSON.stringify(['premium', 'gift']));
});

test('accepts safe image locations', () => {
  const r = run(
    [{ name: 'X', category: 'usb', images: '/uploads/a.png|https://cdn.example.com/b.jpg' }],
    [...HEADERS, 'images']
  );
  assert.equal(r.errors.length, 0);
  assert.equal(r.valid[0].images, JSON.stringify(['/uploads/a.png', 'https://cdn.example.com/b.jpg']));
});

test('rejects javascript:, data: and http: image URLs', () => {
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAA', 'http://x.com/a.png']) {
    const r = run([{ name: 'X', category: 'usb', images: bad }], [...HEADERS, 'images']);
    assert.equal(r.errors.length, 1, `expected ${bad} to be rejected`);
    assert.equal(r.errors[0].column, 'images');
  }
});

test('reports an unknown column as a warning and still imports', () => {
  const r = run([{ name: 'X', category: 'usb', colour: 'red' }], [...HEADERS, 'colour']);
  assert.deepEqual(r.unknownColumns, ['colour']);
  assert.equal(r.valid.length, 1);
  assert.equal(r.errors.length, 0);
});

test('warns about a name duplicated inside the file', () => {
  const r = run([
    { name: 'Same', category: 'usb' },
    { name: 'Same', category: 'usb' },
  ]);
  assert.equal(r.valid.length, 2);
  assert.ok(r.warnings.some((w) => /duplicated/i.test(w.message)));
});

test('warns about a name that already exists in the catalogue', () => {
  const r = run([{ name: 'Existing', category: 'usb' }], HEADERS, CATS, ['existing']);
  assert.ok(r.warnings.some((w) => /already exists/i.test(w.message)));
});

test('warns when price_min is missing, since Gift Finder needs it', () => {
  const r = run([{ name: 'X', category: 'usb' }]);
  assert.ok(r.warnings.some((w) => /gift finder/i.test(w.message)));
});

test('rejects a cell longer than the cell limit', () => {
  const r = run([{ name: 'X'.repeat(MAX_CELL_LENGTH + 1), category: 'usb' }]);
  assert.equal(r.errors[0].column, 'name');
});

test('leaves an absent price as null, not an empty string', () => {
  // An empty string would be stored as TEXT in a REAL column and would pass
  // the Gift Finder's `priceMin !== null` check.
  const r = run([{ name: 'X', category: 'usb' }]);
  assert.equal(r.valid[0].price_min, null);
  assert.equal(r.valid[0].lead_days, null);
});

test('sets every column on every valid row, so the insert needs no fallback', () => {
  const r = run([{ name: 'X', category: 'usb' }]);
  for (const col of COLUMNS) {
    assert.ok(col.name in r.valid[0], `${col.name} missing from the record`);
  }
});

test('accepts empty Arabic columns', () => {
  const r = run(
    [{ name: 'X', category: 'usb', name_ar: '', description_ar: '' }],
    [...HEADERS, 'name_ar', 'description_ar']
  );
  assert.equal(r.errors.length, 0);
  assert.equal(r.valid[0].name_ar, '');
});

test('reports the spreadsheet row number, counting the header as row 1', () => {
  const r = run([
    { name: 'Good', category: 'usb' },
    { name: '', category: 'usb' },
  ]);
  assert.equal(r.errors[0].row, 3);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `validateRows is not a function`

- [ ] **Step 3: Write the implementation**

Append to `server/productImport.js`:

```js
/**
 * The 21 importable columns. The four the table has but this omits —
 * id, created_at, updated_at, sort_order — are set by the system.
 *
 * `type` drives both validation and how the value is stored:
 *   text     → trimmed string
 *   int      → whole number
 *   decimal  → number
 *   list     → pipe-separated (or JSON) → JSON array string
 *   category → must match an existing category id
 */
export const COLUMNS = [
  { name: 'name', required: true, type: 'text', max: 200 },
  { name: 'category', required: true, type: 'category' },
  { name: 'name_ar', type: 'text', max: 200 },
  { name: 'description', type: 'text', max: MAX_CELL_LENGTH },
  { name: 'description_ar', type: 'text', max: MAX_CELL_LENGTH },
  { name: 'features', type: 'list' },
  { name: 'features_ar', type: 'list' },
  { name: 'branding_options', type: 'list' },
  { name: 'branding_options_ar', type: 'list' },
  { name: 'moq', type: 'int', min: 1, default: 50 },
  { name: 'lead_time', type: 'text', max: 100 },
  { name: 'lead_time_ar', type: 'text', max: 100 },
  { name: 'price_range', type: 'text', max: 100 },
  { name: 'price_range_ar', type: 'text', max: 100 },
  { name: 'price_min', type: 'decimal', min: 0 },
  { name: 'price_max', type: 'decimal', min: 0 },
  { name: 'lead_days', type: 'int', min: 0 },
  { name: 'tags', type: 'list' },
  { name: 'notes', type: 'text', max: 2000 },
  { name: 'notes_ar', type: 'text', max: 2000 },
  { name: 'images', type: 'list', urls: true },
];

const COLUMN_NAMES = COLUMNS.map((c) => c.name);
const LIST_COLUMNS = COLUMNS.filter((c) => c.type === 'list').map((c) => c.name);

// Only = and @ are rejected on the way in. The broad spreadsheet rule
// (= + - @ tab CR) belongs on export, where the danger is; applied here it
// would reject "-20% discount" and "+2 year warranty".
const FORMULA_START = /^[=@]/;

/** A cell is a safe image location if it is ours or plainly https. */
function isSafeImageUrl(url) {
  if (url.startsWith('/uploads/')) return true;
  return /^https:\/\/\S+$/i.test(url);
}

/** Pipe-separated, or a JSON array when the cell starts with `[`. Returns
 *  null when the JSON is malformed, which the caller turns into an error. */
function parseList(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      return null;
    }
  }
  return value.split('|').map((v) => v.trim()).filter(Boolean);
}

/**
 * Validate parsed rows against COLUMNS.
 *
 * @param {object[]} rows            from parseCsv
 * @param {string[]} headers         from parseCsv
 * @param {string[]} categoryIds     existing category ids
 * @param {string[]} existingNames   lowercased product names already stored
 * @returns {{ fileError: string|null, valid: object[], errors: object[],
 *             warnings: object[], unknownColumns: string[] }}
 */
export function validateRows(rows, headers, categoryIds, existingNames = []) {
  const missing = COLUMNS.filter((c) => c.required && !headers.includes(c.name)).map((c) => c.name);
  if (missing.length) {
    return {
      fileError: `Required column${missing.length > 1 ? 's' : ''} missing from the header: ${missing.join(', ')}.`,
      valid: [], errors: [], warnings: [], unknownColumns: [],
    };
  }

  const unknownColumns = headers.filter((h) => !COLUMN_NAMES.includes(h));
  const known = new Set(existingNames.map((n) => n.toLowerCase()));
  const seen = new Map();

  const valid = [];
  const errors = [];
  const warnings = [];

  rows.forEach((row, index) => {
    // Spreadsheet numbering: the header occupies row 1.
    const rowNumber = index + 2;
    const rowErrors = [];
    const record = {};

    for (const col of COLUMNS) {
      const raw = String(row[col.name] ?? '').trim();

      if (raw.length > MAX_CELL_LENGTH) {
        rowErrors.push({ row: rowNumber, column: col.name, value: `${raw.slice(0, 40)}…`,
          message: `Longer than ${MAX_CELL_LENGTH} characters.` });
        continue;
      }
      if (FORMULA_START.test(raw)) {
        rowErrors.push({ row: rowNumber, column: col.name, value: raw.slice(0, 40),
          message: 'Starts with = or @, which spreadsheets read as a formula. Remove the leading character.' });
        continue;
      }

      if (!raw) {
        if (col.required) {
          rowErrors.push({ row: rowNumber, column: col.name, value: '', message: 'Required.' });
        } else if (col.type === 'list') {
          record[col.name] = '[]';
        } else if (col.type === 'int' && col.default !== undefined) {
          record[col.name] = col.default;
        } else if (col.type === 'int' || col.type === 'decimal') {
          record[col.name] = null;
        } else {
          record[col.name] = '';
        }
        continue;
      }

      switch (col.type) {
        case 'category':
          if (!categoryIds.includes(raw)) {
            rowErrors.push({ row: rowNumber, column: col.name, value: raw,
              message: `Category does not exist. Valid ids: ${categoryIds.join(', ')}.` });
          } else {
            record[col.name] = raw;
          }
          break;

        case 'int': {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < (col.min ?? 0)) {
            rowErrors.push({ row: rowNumber, column: col.name, value: raw,
              message: `Must be a whole number of at least ${col.min ?? 0}.` });
          } else {
            record[col.name] = n;
          }
          break;
        }

        case 'decimal': {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < (col.min ?? 0)) {
            rowErrors.push({ row: rowNumber, column: col.name, value: raw,
              message: `Must be a number of at least ${col.min ?? 0}.` });
          } else {
            record[col.name] = n;
          }
          break;
        }

        case 'list': {
          const items = parseList(raw);
          if (items === null) {
            rowErrors.push({ row: rowNumber, column: col.name, value: raw.slice(0, 40),
              message: 'Looks like JSON but could not be read. Use pipe-separated values instead: a|b|c' });
            break;
          }
          if (col.urls) {
            const bad = items.find((u) => !isSafeImageUrl(u));
            if (bad) {
              rowErrors.push({ row: rowNumber, column: col.name, value: bad,
                message: 'Images must be an /uploads/... path or an https:// URL.' });
              break;
            }
          }
          record[col.name] = JSON.stringify(items);
          break;
        }

        default:
          if (col.max && raw.length > col.max) {
            rowErrors.push({ row: rowNumber, column: col.name, value: `${raw.slice(0, 40)}…`,
              message: `Longer than ${col.max} characters.` });
          } else {
            record[col.name] = raw;
          }
      }
    }

    // Cross-field rule: a maximum below its minimum is a typo, not a price.
    if (record.price_min != null && record.price_max != null && record.price_max < record.price_min) {
      rowErrors.push({ row: rowNumber, column: 'price_max', value: String(record.price_max),
        message: `Must be at least price_min (${record.price_min}).` });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    const key = record.name.toLowerCase();
    if (seen.has(key)) {
      warnings.push({ row: rowNumber, column: 'name',
        message: `"${record.name}" is duplicated in this file (also row ${seen.get(key)}).` });
    } else {
      seen.set(key, rowNumber);
    }
    if (known.has(key)) {
      warnings.push({ row: rowNumber, column: 'name',
        message: `"${record.name}" already exists in the catalogue. Import creates a second copy.` });
    }
    if (record.price_min == null) {
      warnings.push({ row: rowNumber, column: 'price_min',
        message: 'No price_min — this product cannot appear in Gift Finder results.' });
    }
    if (record.images === '[]') {
      warnings.push({ row: rowNumber, column: 'images',
        message: 'No images — the placeholder image will be used.' });
    }

    valid.push(record);
  });

  return { fileError: null, valid, errors, warnings, unknownColumns };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS — all Task 1 and Task 2 tests

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add server/productImport.js server/productImport.test.js
git commit -m "Add column spec and row validation for product import

Validation is stricter than POST /api/products, which accepts any
category string: an unknown category here is an error, because a product
in a category that does not exist is invisible in the catalogue filter.

Errors stop a row; warnings do not. A name that already exists is a
warning rather than an error — insert-only means a re-uploaded file
would otherwise silently double the catalogue."
```

---

### Task 3: Template generation

**Files:**
- Modify: `server/productImport.js`
- Test: `server/productImport.test.js`

**Interfaces:**
- Consumes: `COLUMNS`, `parseCsv`, `validateRows`
- Produces: `buildTemplate(categories) -> string` where `categories` is `[{ id, name }]`

- [ ] **Step 1: Write the failing test**

Append to `server/productImport.test.js`:

```js
import { buildTemplate } from './productImport.js';

const SAMPLE_CATS = [{ id: 'usb', name: 'USB & Flash Drives' }, { id: 'drinkware', name: 'Drinkware' }];

test('template header lists every importable column', () => {
  const csv = buildTemplate(SAMPLE_CATS);
  const { headers } = parseCsv(Buffer.from(csv, 'utf8'));
  assert.deepEqual(headers, COLUMNS.map((c) => c.name));
});

test('template starts with a BOM so Excel reads Arabic correctly', () => {
  assert.ok(buildTemplate(SAMPLE_CATS).startsWith('﻿'));
});

test('template example rows validate clean against its own rules', () => {
  const csv = buildTemplate(SAMPLE_CATS);
  const parsed = parseCsv(Buffer.from(csv, 'utf8'));
  const result = validateRows(parsed.rows, parsed.headers, SAMPLE_CATS.map((c) => c.id));
  assert.equal(result.fileError, null);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid.length, 2);
});

test('template uses a real category id from the caller', () => {
  const csv = buildTemplate([{ id: 'awards', name: 'Awards' }]);
  assert.ok(csv.includes('awards'));
});

test('template survives having no categories at all', () => {
  const csv = buildTemplate([]);
  assert.ok(csv.startsWith('﻿'));
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `buildTemplate is not a function`

- [ ] **Step 3: Write the implementation**

Append to `server/productImport.js`:

```js
/** Quote a value for CSV output, doubling any embedded quotes. */
function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * Build the downloadable template.
 *
 * Generated rather than shipped as a static file so the example rows always
 * reference categories that actually exist. Two examples: one filled in
 * completely including Arabic, one minimal, both of which the admin deletes.
 */
export function buildTemplate(categories = []) {
  const first = categories[0]?.id || 'usb';
  const second = categories[1]?.id || first;

  const full = {
    name: 'Custom USB Drive',
    name_ar: 'فلاش مخصص',
    category: first,
    description: 'Custom USB with your logo, printed in any shape.',
    description_ar: 'فلاش مخصص بشعارك، مطبوع بأي شكل.',
    features: 'Any shape|3D printed shell|Fast delivery',
    features_ar: 'أي شكل|غلاف مطبوع ثلاثي الأبعاد|تسليم سريع',
    branding_options: 'Full colour print|Laser engraving',
    branding_options_ar: 'طباعة كاملة الألوان|حفر ليزر',
    moq: 150,
    lead_time: '3 weeks',
    lead_time_ar: '٣ أسابيع',
    price_range: 'EGP 290 - EGP 350 per unit',
    price_range_ar: '٢٩٠ - ٣٥٠ جنيه للقطعة',
    price_min: 290,
    price_max: 350,
    lead_days: 21,
    tags: 'tech|corporate|premium',
    notes: 'Internal note, not shown on the site.',
    notes_ar: 'ملاحظة داخلية لا تظهر على الموقع.',
    images: '/uploads/example.png',
  };

  const minimal = { name: 'Simple Keychain', category: second, moq: 500 };

  const header = COLUMNS.map((c) => c.name).join(',');
  const body = [full, minimal]
    .map((row) => COLUMNS.map((c) => csvCell(row[c.name] ?? '')).join(','))
    .join('\n');

  // BOM so Excel opens the Arabic columns in UTF-8, matching the export.
  return `﻿${header}\n${body}\n`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add server/productImport.js server/productImport.test.js
git commit -m "Generate the product import template

Generated per request rather than served as a static file, so the example
rows always reference categories that currently exist. A test parses the
template back through the validator and asserts zero errors, so the
template and the rules it teaches cannot drift apart."
```

---

### Task 4: Close the formula-injection hole in export

**Files:**
- Modify: `server/routes/export.js`
- Test: `server/exportCsv.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `toCSV(rows, columns) -> string`, now a named export from `server/routes/export.js`

- [ ] **Step 1: Write the failing test**

Create `server/exportCsv.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV } from './routes/export.js';

test('prefixes a value that a spreadsheet would run as a formula', () => {
  const out = toCSV([{ name: '=cmd|\'/c calc\'!A1' }], ['name']);
  assert.ok(out.includes(`"'=cmd`), `formula was not escaped: ${out}`);
});

test('escapes every spreadsheet trigger character', () => {
  for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
    const out = toCSV([{ name: `${prefix}danger` }], ['name']);
    assert.ok(out.includes(`"'${prefix}danger"`), `not escaped: ${JSON.stringify(prefix)}`);
  }
});

test('leaves ordinary values untouched', () => {
  const out = toCSV([{ name: 'Custom USB Drive' }], ['name']);
    assert.ok(out.includes('"Custom USB Drive"'));
  assert.ok(!out.includes("'Custom"));
});

test('still doubles embedded quotes', () => {
  const out = toCSV([{ name: 'He said "hi"' }], ['name']);
  assert.ok(out.includes('"He said ""hi"""'));
});

test('still serialises objects as JSON', () => {
  const out = toCSV([{ tags: ['a', 'b'] }], ['tags']);
  assert.ok(out.includes('["a","b"]'));
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `toCSV` is not exported, and the escaping assertions fail

Note: importing `server/routes/export.js` pulls in `server/db.js`, which opens
`server/data.db` (it does not run `initDb`, so no migration or seeding happens).
The test therefore needs the database file to be present, which it is in any
working checkout.

- [ ] **Step 3: Modify the implementation**

In `server/routes/export.js`, replace the existing `toCSV` helper with:

```js
// Characters a spreadsheet treats as the start of a formula. A product named
// =cmd|'/c calc'!A1 would otherwise execute when the export is opened in Excel.
// Prefixing an apostrophe makes the cell literal text.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

// Helper: convert array of objects to CSV string
export function toCSV(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      let val = row[col] ?? '';
      if (typeof val === 'object') val = JSON.stringify(val);
      val = String(val);
      if (FORMULA_TRIGGERS.test(val)) val = `'${val}`;
      val = val.replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Confirm the four export endpoints still work**

```bash
npm run lint
```
Expected: 30 problems, the unchanged baseline.

- [ ] **Step 6: Commit**

```bash
git add server/routes/export.js server/exportCsv.test.js
git commit -m "Escape spreadsheet formulas in CSV export

toCSV emitted cell values verbatim, so a product named =cmd|'/c calc'!A1
exported as a live formula that runs when the file is opened in Excel.
Verified before the fix by calling the function directly.

On its own this needed someone to already have that value in the
database. The product import being added alongside is the missing write
half of that chain, so it is fixed here rather than left as a follow-up."
```

---

### Task 5: Import endpoints

**Files:**
- Create: `server/routes/import.js`
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `parseCsv`, `validateRows`, `buildTemplate`, `COLUMNS` from `server/productImport.js`
- Produces: three HTTP endpoints; preview returns
  `{ rowCount, validCount, errors, warnings, unknownColumns, preview, fingerprint }`

- [ ] **Step 1: Write the route module**

Create `server/routes/import.js`:

```js
import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { parseCsv, validateRows, buildTemplate, COLUMNS } from '../productImport.js';

const router = Router();

// A separate multer instance from the image uploader on purpose.
// memoryStorage means the file never touches disk: nothing to clean up, no
// path traversal, and nothing that could later be served back.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  // Extension only, deliberately: browsers report CSV as text/csv,
  // application/vnd.ms-excel, text/plain or application/octet-stream depending
  // on the OS, so a MIME allowlist rejects real files without adding safety.
  // The check that matters is that the bytes parse as CSV with the expected
  // headers, which happens next. Magic bytes do not apply to text.
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(new Error('Only .csv files are accepted.'));
    }
    cb(null, true);
  },
});

/** Wraps multer so its errors come back as JSON rather than a 500. */
function receiveCsv(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. The maximum is 5MB.'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    next();
  });
}

const categoryIds = () => db.prepare('SELECT id FROM categories').all().map((c) => c.id);
const existingNames = () => db.prepare('SELECT name FROM products').all().map((p) => p.name);

/** Parse + validate a buffer. Shared so preview and commit cannot diverge. */
function inspect(buffer) {
  const parsed = parseCsv(buffer);
  if (parsed.error) return { fileError: parsed.error };
  const result = validateRows(parsed.rows, parsed.headers, categoryIds(), existingNames());
  if (result.fileError) return { fileError: result.fileError };
  return { ...result, rowCount: parsed.rows.length };
}

const fingerprintOf = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// GET /api/import/products/template
router.get('/products/template', authenticate, requirePermission('products.create'), (_req, res) => {
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort_order').all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"');
  res.send(buildTemplate(categories));
});

// POST /api/import/products/preview — validate only, write nothing
router.post('/products/preview', authenticate, requirePermission('products.create'), receiveCsv, (req, res) => {
  const result = inspect(req.file.buffer);
  if (result.fileError) return res.status(400).json({ error: result.fileError });

  res.json({
    rowCount: result.rowCount,
    validCount: result.valid.length,
    errors: result.errors,
    warnings: result.warnings,
    unknownColumns: result.unknownColumns,
    preview: result.valid.slice(0, 5).map((p) => ({ name: p.name, category: p.category, moq: p.moq })),
    fingerprint: fingerprintOf(req.file.buffer),
  });
});

// POST /api/import/products — insert the valid rows
router.post('/products', authenticate, requirePermission('products.create'), receiveCsv, (req, res) => {
  const { fingerprint } = req.body;
  if (!fingerprint || fingerprint !== fingerprintOf(req.file.buffer)) {
    return res.status(400).json({ error: 'This is not the file you previewed. Validate it again before importing.' });
  }

  // Re-validated from the bytes, never from anything the client sends back:
  // a tampered client must not be able to slip a row past validation.
  const result = inspect(req.file.buffer);
  if (result.fileError) return res.status(400).json({ error: result.fileError });
  if (!result.valid.length) return res.status(400).json({ error: 'Nothing to import — no row passed validation.' });

  const columns = COLUMNS.map((c) => c.name);
  const insert = db.prepare(`
    INSERT INTO products (${columns.join(', ')}, sort_order)
    VALUES (${columns.map(() => '?').join(', ')}, ?)
  `);

  const startOrder = (db.prepare('SELECT MAX(sort_order) as max FROM products').get().max ?? -1) + 1;

  // One transaction: a failure part-way leaves no products behind.
  const importAll = db.transaction((records) => {
    records.forEach((record, i) => {
      // No `?? ''` fallback here. validateRows sets every one of the 21 keys on
      // every row it returns, and `null ?? ''` would turn an absent price_min
      // into an empty string — which SQLite stores as TEXT in a REAL column and
      // which would pass the Gift Finder's `priceMin !== null` check.
      insert.run(...columns.map((c) => record[c]), startOrder + i);
    });
  });
  importAll(result.valid);

  console.log(`[import] ${req.user.username} imported ${result.valid.length} product(s)`);
  res.json({ imported: result.valid.length });
});

export default router;
```

- [ ] **Step 2: Mount the route**

In `server/index.js`, after the line `import webhookRoutes from './routes/webhooks.js';` add:

```js
import importRoutes from './routes/import.js';
```

and after the line `app.use('/api/webhooks', webhookRoutes);` add:

```js
app.use('/api/import', importRoutes);
```

- [ ] **Step 3: Verify the endpoints by hand**

Start the API, then with a valid admin token in `$T`:

```bash
# Template downloads and has 21 columns
curl -s localhost:3001/api/import/products/template -H "Authorization: Bearer $T" | head -1

# A file with a bad row previews without writing anything
printf 'name,category\nGood,usb\nBad,nope\n' > /tmp/t.csv
BEFORE=$(curl -s localhost:3001/api/products | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')
curl -s -X POST localhost:3001/api/import/products/preview -H "Authorization: Bearer $T" -F file=@/tmp/t.csv
AFTER=$(curl -s localhost:3001/api/products | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')
echo "before=$BEFORE after=$AFTER"   # must be equal
```

Expected: preview reports `validCount: 1` with one error on row 3, and the product count is unchanged.

```bash
# A wrong fingerprint is refused
curl -s -X POST localhost:3001/api/import/products -H "Authorization: Bearer $T" -F file=@/tmp/t.csv -F fingerprint=wrong
```

Expected: `{"error":"This is not the file you previewed. …"}`

```bash
# Without the permission
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3001/api/import/products/preview -F file=@/tmp/t.csv
```

Expected: `401`

- [ ] **Step 4: Import for real and confirm the count and ordering**

```bash
FP=$(curl -s -X POST localhost:3001/api/import/products/preview -H "Authorization: Bearer $T" -F file=@/tmp/t.csv | python3 -c 'import json,sys;print(json.load(sys.stdin)["fingerprint"])')
curl -s -X POST localhost:3001/api/import/products -H "Authorization: Bearer $T" -F file=@/tmp/t.csv -F fingerprint=$FP
```

Expected: `{"imported":1}`, the new product last in `GET /api/products`. Delete it afterwards to leave the catalogue as it was.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add server/routes/import.js server/index.js
git commit -m "Add product CSV import endpoints

Two steps and no server state: preview parses and validates and writes
nothing; the commit endpoint re-uploads the same file and re-validates it
from the bytes. The file crossing the wire twice is deliberate — the
client cannot hand back a row list and have it trusted, and there is no
staging table to expire or clean up. A SHA-256 fingerprint stops someone
previewing one file and confirming another.

memoryStorage, and a multer instance separate from the image uploader, so
no CSV ever lands on disk."
```

---

### Task 6: Admin UI

**Files:**
- Create: `src/components/ImportProducts.jsx`
- Modify: `src/pages/Admin.jsx`, `src/i18n/en.js`, `src/i18n/ar.js`

**Interfaces:**
- Consumes: the three endpoints from Task 5
- Produces: `<ImportProducts onImported={fn} />`, calling `onImported()` after a successful import so the caller can refresh its product list

- [ ] **Step 1: Add the translation keys**

In `src/i18n/en.js`, add a top-level `productImport` section:

```js
  productImport: {
    button: 'Import CSV',
    title: 'Import products',
    intro: 'Start from the template so your columns match.',
    downloadTemplate: '⬇ Download CSV template',
    chooseFile: 'Choose file',
    validate: 'Validate file',
    validating: 'Checking...',
    cancel: 'Cancel',
    importing: 'Importing...',
    importAction: 'Import {count} products',
    summary: '{total} rows · {valid} ready · {errors} with errors',
    unknownColumn: 'Unknown column "{column}" — it will be ignored',
    previewTitle: 'First products to be added:',
    nothingValid: 'No row passed validation. Fix the file and try again.',
    done: 'Imported {count} products.',
    rowLabel: 'Row',
  },
```

In `src/i18n/ar.js`, add the same section with the same keys:

```js
  productImport: {
    button: 'استيراد CSV',
    title: 'استيراد منتجات',
    intro: 'ابدأ بالقالب حتى تتطابق الأعمدة.',
    downloadTemplate: '⬇ تحميل قالب CSV',
    chooseFile: 'اختر ملفاً',
    validate: 'فحص الملف',
    validating: 'جارٍ الفحص...',
    cancel: 'إلغاء',
    importing: 'جارٍ الاستيراد...',
    importAction: 'استورد {count} منتج',
    summary: '{total} صف · {valid} جاهز · {errors} فيها أخطاء',
    unknownColumn: 'عمود غير معروف "{column}" — سيتم تجاهله',
    previewTitle: 'أول المنتجات التي ستضاف:',
    nothingValid: 'لم يجتز أي صف الفحص. صحح الملف وحاول مرة أخرى.',
    done: 'تم استيراد {count} منتج.',
    rowLabel: 'صف',
  },
```

- [ ] **Step 2: Verify the two dictionaries stayed in step**

```bash
node --input-type=module -e "
import en from './src/i18n/en.js'; import ar from './src/i18n/ar.js';
const missing = Object.keys(en.productImport).filter(k => !(k in ar.productImport));
if (missing.length) { console.error('missing in ar:', missing); process.exit(1); }
console.log('parity ok:', Object.keys(en.productImport).length, 'keys');
"
```
Expected: `parity ok: 15 keys`

- [ ] **Step 3: Write the component**

Create `src/components/ImportProducts.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const fill = (template, values) =>
  Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), template);

/** Uploads a file to an endpoint that expects multipart form data. */
async function postFile(path, file, extra = {}) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(extra).forEach(([k, v]) => body.append(k, v));

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    body,
  });
  const data = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ImportProducts({ onImported }) {
  const { t } = useLanguage();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const reset = () => {
    setFile(null); setReport(null); setError(''); setDone(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const downloadTemplate = async () => {
    const res = await fetch('/api/import/products/template', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    });
    if (!res.ok) { setError('Could not download the template'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = 'products-import-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const validate = async () => {
    setBusy(true); setError(''); setReport(null);
    try {
      setReport(await postFile('/import/products/preview', file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true); setError('');
    try {
      const result = await postFile('/import/products', file, { fingerprint: report.fingerprint });
      setDone(result.imported);
      setReport(null);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const box = 'bg-white rounded-xl border border-gray-100 p-6';
  const btn = 'px-5 py-2 font-medium text-sm rounded-lg cursor-pointer border-none transition-colors';

  if (done !== null) {
    return (
      <div className={box}>
        <p className="text-green-700 font-medium mb-4">{fill(t('productImport.done'), { count: done })}</p>
        <button onClick={reset} className={`${btn} bg-gray-100 text-text-muted hover:bg-gray-200`}>
          {t('productImport.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className={`${box} space-y-4`}>
      <div>
        <h3 className="font-semibold text-text">{t('productImport.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('productImport.intro')}</p>
      </div>

      <button onClick={downloadTemplate} className={`${btn} bg-blue-50 text-accent hover:bg-blue-100`}>
        {t('productImport.downloadTemplate')}
      </button>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); setError(''); }}
          className="text-sm"
        />
        <button
          onClick={validate}
          disabled={!file || busy}
          className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}
        >
          {busy && !report ? t('productImport.validating') : t('productImport.validate')}
        </button>
      </div>

      {report && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-text">
            {fill(t('productImport.summary'), {
              total: report.rowCount, valid: report.validCount, errors: report.errors.length,
            })}
          </p>

          {report.unknownColumns.map((column) => (
            <p key={column} className="text-xs text-amber-700">
              ⚠ {fill(t('productImport.unknownColumn'), { column })}
            </p>
          ))}

          {report.errors.length > 0 && (
            <div className="max-h-56 overflow-y-auto space-y-1">
              {report.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">
                  ✗ {t('productImport.rowLabel')} {e.row} · <span className="font-mono">{e.column}</span> · {e.message}
                </p>
              ))}
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {report.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">
                  ⚠ {t('productImport.rowLabel')} {w.row} · {w.message}
                </p>
              ))}
            </div>
          )}

          {report.preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">{t('productImport.previewTitle')}</p>
              {report.preview.map((p, i) => (
                <p key={i} className="text-xs text-text-muted">
                  {p.name} · {p.category} · MOQ {p.moq}
                </p>
              ))}
            </div>
          )}

          {report.validCount === 0 && (
            <p className="text-sm text-red-700">{t('productImport.nothingValid')}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={reset} className={`${btn} bg-gray-100 text-text-muted hover:bg-gray-200`}>
              {t('productImport.cancel')}
            </button>
            <button
              onClick={runImport}
              disabled={busy || report.validCount === 0}
              className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}
            >
              {busy ? t('productImport.importing')
                    : fill(t('productImport.importAction'), { count: report.validCount })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the Products tab**

In `src/pages/Admin.jsx`:

Add the import beside the other component imports:

```jsx
import ImportProducts from '../components/ImportProducts';
```

Add state next to the other Products-tab state:

```jsx
  const [showImport, setShowImport] = useState(false);
```

Find the row holding the Export CSV and Add Product buttons in the Products tab and add a third button between them:

```jsx
              {hasPermission('products.create') && (
                <button onClick={() => setShowImport((v) => !v)} className={btnSecondary}>
                  {t('productImport.button')}
                </button>
              )}
```

Directly below that button row, render the panel:

```jsx
            {showImport && hasPermission('products.create') && (
              <div className="mb-6">
                <ImportProducts onImported={() => { refreshProducts(); setShowImport(false); }} />
              </div>
            )}
```

`refreshProducts` is already destructured from `useProducts()` as `retry: refreshProducts`. `t` comes from `useLanguage()`; if `Admin.jsx` does not already call it, add `const { t } = useLanguage();` alongside the other hooks and import `useLanguage` from `../context/LanguageContext`.

- [ ] **Step 5: Lint and build**

```bash
npm run lint && npm run build
```
Expected: 30 problems (the unchanged baseline) and a successful build.

- [ ] **Step 6: Commit**

```bash
git add src/components/ImportProducts.jsx src/pages/Admin.jsx src/i18n/en.js src/i18n/ar.js
git commit -m "Add the CSV import panel to the Products tab

Its own component rather than more code in Admin.jsx, which is already
around 4000 lines.

The action button states the exact count — 'Import 17 products', not
'Confirm' — so what is about to happen is never ambiguous. Errors carry
row number, column, and the offending value, so the admin can go straight
to that line in Excel. The template button sits above file selection in
reading order, so a first-time user meets it before making a malformed
file."
```

---

### Task 7: End-to-end verification and documentation

**Files:**
- Modify: `BRD.md`
- Modify: `~/.claude/projects/-Users-gehadelsobky-Claude-Code-3D-Tech/memory/MEMORY.md` and a new memory file

**Interfaces:**
- Consumes: everything above
- Produces: nothing code depends on

- [ ] **Step 1: Exercise the full flow in the browser**

Start both servers (`preview_start` with `api` then `vite`), sign in, and open the Products tab.

1. Download the template. Confirm it opens in a spreadsheet with Arabic intact and has 21 columns.
2. Upload a deliberately broken file:

```bash
printf 'name,category,moq,colour\nGood Product,usb,50,red\n,usb,50,red\nBad Cat,nope,50,red\nBad Moq,usb,many,red\n=cmd|calc,usb,50,red\n' > /tmp/broken.csv
```

Expected on screen: `5 rows · 1 ready · 4 with errors`, a warning naming the unknown column `colour`, four row errors each naming its column, and the action button reading "Import 1 products".

3. Confirm the import. Expected: "Imported 1 products", the list refreshes, and the new product is last in the catalogue.
4. Delete the imported product to leave the catalogue as it was.
5. Switch to Arabic and repeat step 2. Confirm the panel is right-to-left and every string is translated.

- [ ] **Step 2: Confirm preview writes nothing**

```bash
node -e "
const D=require('better-sqlite3');const db=new D('server/data.db',{readonly:true});
console.log('products:', db.prepare('SELECT COUNT(*) c FROM products').get().c);
"
```
Run before and after a preview. The counts must match.

- [ ] **Step 3: Update the BRD**

In `BRD.md`, under **FR-2 Product catalogue**, add:

```markdown
- **FR-2.6** **Bulk import.** Products can be created in bulk from a CSV.
  Import is **insert-only** — it cannot modify or delete an existing product.
  It runs in two steps: a preview parses and validates the file and writes
  nothing, then the admin confirms and the valid rows insert in one
  transaction. A template covering all 21 importable columns (Arabic
  included) is generated on request so its example categories are always
  current. Limits: 1000 rows, 5000 characters per cell, 5 MB per file.
  Unknown columns are a warning, not a rejection. Imported products append to
  the end of the catalogue. Import does **not** emit per-row `product.created`
  webhooks — importing 500 products would otherwise fire 500 deliveries.
```

In the security section, alongside the other non-functional entries, add:

```markdown
- CSV export escapes values a spreadsheet would run as a formula; CSV import
  rejects cells beginning with `=` or `@`.
```

- [ ] **Step 4: Write the memory file**

Create `~/.claude/projects/-Users-gehadelsobky-Claude-Code-3D-Tech/memory/3dtech-csv-import.md`:

```markdown
---
name: 3dtech-csv-import
description: Product CSV import is insert-only and two-step; the commit endpoint re-validates from the file and never trusts the preview.
metadata:
  type: project
---

Bulk product import lives in `server/productImport.js` (pure: parsing,
validation, template) and `server/routes/import.js` (three endpoints). The
pure module has real tests — `server/productImport.test.js`, run with
`npm test` on Node's built-in runner. This is the project's only test suite.

**Rules that must not be relaxed:**
- **Insert only.** No update or delete path through import, so a bad file can
  never destroy catalogue data.
- The commit endpoint **re-parses and re-validates from the uploaded bytes**
  and ignores any row list the client sends. A SHA-256 fingerprint stops
  someone previewing one file and confirming another. The file crossing the
  wire twice is the design, not an oversight.
- multer uses **memoryStorage** with its own instance, separate from the image
  uploader. No CSV touches disk.
- Import rejects cells starting with `=` or `@` only. The broad spreadsheet
  rule (`= + - @ \t \r`) lives on **export**, in `toCSV` — applied on import it
  would reject "-20% discount" and "+2 year warranty".
- The template is **generated**, not a static file, so its example category ids
  always exist. A test round-trips the template through the validator and
  asserts zero errors, so the two cannot drift.
- Import does not emit per-row `product.created` webhooks, unlike
  `POST /api/products`. Deliberate: 500 rows would mean 500 deliveries.

Related: [[3dtech-brd-source-of-truth]], [[3dtech-catalog-ordering]],
[[3dtech-bilingual-rules]]
```

Add to `MEMORY.md`:

```markdown
- [CSV import](3dtech-csv-import.md) — insert-only, two-step, re-validated on commit; the project's only test suite.
```

- [ ] **Step 5: Final check and commit**

```bash
npm test && npm run lint && npm run build
git add BRD.md
git commit -m "Document product CSV import in the BRD

Records the decisions a future reader would otherwise have to reverse
engineer: why import is insert-only, why it is two-step, and why it
deliberately does not emit per-row webhooks."
```
