import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, MAX_ROWS, MAX_CELL_LENGTH, buildTemplate } from './productImport.js';
import { validateRows, COLUMNS } from './productImport.js';

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

test('a quoted comma is not reported as a row-level parse problem', () => {
  const r = parseCsv(buf('name,description\n"Gift Set","Red, blue\nand green"\n'));
  assert.equal(r.rowErrors.length, 0);
});

test('a stray unquoted comma is reported as a row-level parse problem, not silently dropped', () => {
  // Reproduces the bug: an unquoted comma inside `description` splits the
  // row into an extra field that papaparse puts in `__parsed_extra`, which
  // is neither a COLUMNS name nor a header, so it was previously invisible.
  const r = parseCsv(buf(
    'name,category,moq,price_min,price_max,description\n'
    + 'ZZ Probe,usb,10,5,9,A great mug, made of steel\n'
    + 'Good,usb,10,5,9,fine\n'
  ));
  assert.equal(r.error, null);
  assert.equal(r.rowErrors.length, 1);
  assert.equal(r.rowErrors[0].index, 0);
  assert.match(r.rowErrors[0].message, /quote/i);
});

test('an unterminated quote is reported as a row-level parse problem', () => {
  const r = parseCsv(buf('name,category\nA,usb\n"Bad start,usb\n'));
  assert.equal(r.error, null);
  assert.ok(r.rowErrors.length >= 1);
  assert.match(r.rowErrors[0].message, /quote/i);
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

test('accepts a file with exactly MAX_ROWS rows', () => {
  const body = Array.from({ length: MAX_ROWS }, (_, i) => `P${i},usb`).join('\n');
  const r = parseCsv(buf(`name,category\n${body}\n`));
  assert.equal(r.error, null);
  assert.equal(r.rows.length, MAX_ROWS);
});

test('rejects a file with no data rows', () => {
  const r = parseCsv(buf('name,category\n'));
  assert.match(r.error, /no data rows/i);
});

test('still parses a legitimate single-column CSV', () => {
  // This is the case that made the brief's "reject on any delimiter
  // warning" check wrong: Papaparse can't detect a delimiter with only one
  // column to look at, but it still parses the file correctly.
  const r = parseCsv(buf('name\nUSB Drive\nMug\n'));
  assert.equal(r.error, null);
  assert.deepEqual(r.rows, [{ name: 'USB Drive' }, { name: 'Mug' }]);
});

test('rejects binary content (e.g. a spreadsheet file renamed to .csv)', () => {
  // The local file header of a .xlsx/.zip: "PK\x03\x04" followed by more
  // binary bytes, including NUL bytes, with a newline so it decodes into
  // more than one line rather than one long "column".
  const binary = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00,
    0x08, 0x00, 0x21, 0x00, 0x0a, 0x00, 0x00, 0x00,
    0x08, 0x00, 0x00, 0x00,
  ]);
  const r = parseCsv(binary);
  assert.notEqual(r.error, null);
});

const CATS = ['usb', 'drinkware', 'gift-sets'];
const HEADERS = ['name', 'category'];
const run = (rows, headers = HEADERS, cats = CATS, existing = [], rowMeta = {}) =>
  validateRows(rows, headers, cats, existing, rowMeta);

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

test('rejects a list cell that looks like JSON but is malformed', () => {
  // A regression to `parseList` returning `[]` on a JSON.parse failure
  // (instead of null) would silently import an empty list here instead of
  // erroring the row — this is the test that would catch that.
  const r = run([{ name: 'X', category: 'usb', tags: '[not valid json' }], [...HEADERS, 'tags']);
  assert.equal(r.errors[0].column, 'tags');
  assert.equal(r.valid.length, 0);
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

test('a ragged row (stray unquoted comma) is reported and does not import', () => {
  const parsed = parseCsv(buf(
    'name,category,moq,price_min,price_max,description\n'
    + 'ZZ Probe,usb,10,5,9,A great mug, made of steel\n'
    + 'Good,usb,10,5,9,fine\n'
  ));
  const r = validateRows(parsed.rows, parsed.headers, CATS, [], {
    lineNumbers: parsed.lineNumbers, rowErrors: parsed.rowErrors,
  });
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].name, 'Good');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 2);
  assert.match(r.errors[0].message, /quote/i);
  assert.equal(r.erroredRowCount, 1);
});

test('a quoted comma still parses and imports fine', () => {
  const parsed = parseCsv(buf('name,category,description\nGift Set,usb,"Red, and green"\n'));
  const r = validateRows(parsed.rows, parsed.headers, CATS, [], {
    lineNumbers: parsed.lineNumbers, rowErrors: parsed.rowErrors,
  });
  assert.equal(r.errors.length, 0);
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].description, 'Red, and green');
});

test('a blank line above an error does not shift the reported row number', () => {
  // header=1, A/usb=2, blank=3, B/nope=4 — a plain index+2 would misreport
  // the bad row (index 1 in the post-skip array) as row 3.
  const parsed = parseCsv(buf('name,category\nA,usb\n\nB,nope\n'));
  const r = validateRows(parsed.rows, parsed.headers, CATS, [], {
    lineNumbers: parsed.lineNumbers, rowErrors: parsed.rowErrors,
  });
  assert.equal(r.errors[0].column, 'category');
  assert.equal(r.errors[0].row, 4);
});

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
