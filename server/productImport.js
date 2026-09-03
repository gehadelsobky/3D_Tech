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
