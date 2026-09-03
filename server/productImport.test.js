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
