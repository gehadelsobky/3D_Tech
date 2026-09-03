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
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  // Papaparse always emits an "UndetectableDelimiter" warning when a file
  // has only one column (nothing to detect a delimiter from) and still
  // defaults to comma and parses correctly, so it is not treated as fatal
  // here. A genuinely unreadable file falls through to the empty-headers or
  // empty-rows checks below, which produce a more accurate message anyway.
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
