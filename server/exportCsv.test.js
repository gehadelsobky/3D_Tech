import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV } from './routes/export.js';
import { parseCsv, validateRows } from './productImport.js';

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
  assert.ok(out.includes('[""a"",""b""]'));
});

// Known limitation: formula-escaped values retain their apostrophe through
// export/import. This is intentional and documented — we do not strip leading
// apostrophes on import, because that would silently eat legitimate ones from
// data that never passed through toCSV, and would break the security boundary
// for consumers that bypass our export (the webhook emitter, the backup job).
// This test pins down the behavior so it cannot regress silently.
test('export/import round trip: trigger-prefixed values keep their apostrophe (known limitation)', () => {
  // Simulate a product with a value that needs formula escaping
  const original = {
    name: 'Launch Item',
    category: 'usb',
    price_range: '-20% launch offer',
    price_min: 10,
    price_max: 20,
    moq: 50,
  };

  // First cycle: export
  const firstExport = toCSV([original], ['name', 'category', 'price_range', 'price_min', 'price_max', 'moq']);

  // Parse the exported CSV
  const buffer = Buffer.from(firstExport);
  const parsed = parseCsv(buffer);
  assert.equal(parsed.error, null, 'parseCsv should not error');
  assert.equal(parsed.rows.length, 1, 'should have one data row');

  // Validate and import
  const validated = validateRows(parsed.rows, parsed.headers, ['usb']);
  assert.equal(validated.fileError, null, 'validateRows should not error');
  assert.equal(validated.errors.length, 0, 'should have no row errors');
  assert.equal(validated.valid.length, 1, 'should have one valid row');

  const reimported = validated.valid[0];

  // Assert: the price_range now has a leading apostrophe (escaping artifact)
  assert.equal(
    reimported.price_range,
    "'-20% launch offer",
    'trigger-prefixed value should keep its apostrophe after round trip'
  );

  // Assert: other fields are unchanged
  assert.equal(reimported.name, 'Launch Item');
  assert.equal(reimported.category, 'usb');
  assert.equal(reimported.price_min, 10);
  assert.equal(reimported.price_max, 20);
  assert.equal(reimported.moq, 50);

  // Second cycle: verify the apostrophe is stable (export/import again)
  const secondExport = toCSV([reimported], ['name', 'category', 'price_range', 'price_min', 'price_max', 'moq']);
  const reparsed = parseCsv(Buffer.from(secondExport));
  const revalidated = validateRows(reparsed.rows, reparsed.headers, ['usb']);

  const secondRound = revalidated.valid[0];
  assert.equal(
    secondRound.price_range,
    "'-20% launch offer",
    'second export/import cycle should leave apostrophe unchanged'
  );

  // Normal values survive byte-identical
  const normalOriginal = { name: 'Normal Item', category: 'usb', price_range: 'EGP 100 - 200' };
  const normalExport = toCSV([normalOriginal], ['name', 'category', 'price_range']);
  const normalParsed = parseCsv(Buffer.from(normalExport));
  const normalValidated = validateRows(normalParsed.rows, normalParsed.headers, ['usb']);
  const normalRound = normalValidated.valid[0];

  assert.equal(
    normalRound.price_range,
    'EGP 100 - 200',
    'non-trigger value should survive unchanged'
  );
  assert.ok(
    !normalRound.price_range.startsWith("'"),
    'non-trigger value should not acquire an apostrophe'
  );
});
