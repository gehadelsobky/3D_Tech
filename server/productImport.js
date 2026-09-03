import Papa from 'papaparse';

/**
 * Pure helpers for the product CSV import. No HTTP, no database — everything
 * here is a function of its arguments, so it can be tested on its own.
 */

export const MAX_ROWS = 1000;
export const MAX_CELL_LENGTH = 5000;

const UNREADABLE_ERROR = 'File could not be read as CSV. Save it as a comma-separated .csv file.';

// A control character other than tab/CR/LF has no business in a CSV header;
// its presence means the bytes are binary, not text.
// eslint-disable-next-line no-control-regex -- intentional: detecting binary content
const CONTROL_CHAR = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

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

  // Papaparse always emits an "UndetectableDelimiter" warning when a file
  // has only one column (nothing to detect a delimiter from), even though it
  // still defaults to comma and parses the file correctly - a legitimate
  // single-column CSV raises the exact same warning as a binary file that
  // happens to decode into one "column" of noise. So that warning cannot be
  // used to tell the two apart; look at the actual bytes instead. A NUL byte
  // or a U+FFFD replacement character (produced when invalid UTF-8, e.g. a
  // zip/xlsx file misnamed .csv, gets decoded) anywhere in the text is
  // direct evidence of binary content.
  if (text.includes('\x00') || text.includes('\uFFFD')) {
    return { headers: [], rows: [], error: UNREADABLE_ERROR };
  }

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = (result.meta.fields || []).filter(Boolean);
  if (!headers.length) {
    return { headers: [], rows: [], error: 'File has no header row.' };
  }
  // Binary content that happens to contain no NUL/replacement byte can still
  // land here with a header full of control characters (e.g. a zip's local
  // file signature); reject that too.
  if (headers.some((h) => CONTROL_CHAR.test(h))) {
    return { headers: [], rows: [], error: UNREADABLE_ERROR };
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
