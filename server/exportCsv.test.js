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
  assert.ok(out.includes('[""a"",""b""]'));
});
