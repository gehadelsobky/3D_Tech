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

// Human-facing messages for the row-level problems Papaparse can raise while
// parsing a single row (as opposed to `error`, which rejects the whole
// file). Each is actionable: the fix for a stray unquoted delimiter or an
// unbalanced quote is always to wrap the cell in quotes.
const ROW_PARSE_PROBLEMS = {
  TooManyFields: 'This row has more fields than the header \u2014 probably a comma inside a cell that isn\u2019t quoted. Wrap that cell\u2019s value in double quotes.',
  TooFewFields: 'This row has fewer fields than the header \u2014 check for a missing comma, or wrap a cell in double quotes if its value contains one.',
  MissingQuotes: 'This row has a quoted cell that is never closed. Add the missing closing quote.',
  InvalidQuotes: 'This row has a quote in the wrong place. Wrap the cell in double quotes, and write any quote inside it as two double quotes.',
};

/** Map Papaparse's `result.errors` onto the row indices of `result.data`,
 *  keeping one message per row. A `Quotes` error can report the row it
 *  belongs to before that row has been inserted (`row: data.length`,
 *  per Papaparse's own source comment) \u2014 clamp to the last real index. */
function collectRowProblems(papaErrors, dataLength) {
  const problems = new Map();
  for (const err of papaErrors) {
    const message = ROW_PARSE_PROBLEMS[err.code];
    if (!message || typeof err.row !== 'number' || dataLength === 0) continue;
    const index = Math.min(err.row, dataLength - 1);
    if (index < 0 || problems.has(index)) continue;
    problems.set(index, message);
  }
  return problems;
}

/** Recover each row's true spreadsheet line number (header = line 1).
 *
 * The real parse below uses `skipEmptyLines: 'greedy'`, which drops blank
 * lines from `result.data` entirely \u2014 so a plain `index + 2` shifts every
 * row after a blank line down by one. This second, lenient pass keeps blank
 * lines in place so their true line numbers can be recovered; its own
 * parse errors are irrelevant and discarded, only row positions matter.
 * Returns one entry per row of the real parse's `result.data`, in order. */
function computeTrueLines(text, dataLength) {
  const stripped = text.replace(/\r?\n$/, ''); // drop one trailing newline so
  // it doesn't parse as a phantom final blank row.
  const raw = Papa.parse(stripped, { header: true, skipEmptyLines: false });
  const lines = [];
  raw.data.forEach((row, i) => {
    const blank = !Object.values(row).some((v) => String(v ?? '').trim() !== '');
    if (!blank) lines.push(i + 2); // line 1 is the header
  });
  // Defensive: this pass uses the same "blank" definition as the real parse
  // and should always agree with it. If it ever doesn't, fall back to plain
  // sequential numbering rather than reporting a wrong line.
  return lines.length === dataLength ? lines : Array.from({ length: dataLength }, (_, i) => i + 2);
}

/**
 * Parse an uploaded CSV buffer.
 *
 * Papaparse rather than a hand-rolled split: this project's own export writes
 * quoted cells with a BOM, and cells may legitimately contain commas and
 * newlines. Getting RFC 4180 right by hand is a known trap.
 *
 * @returns {{ headers: string[], rows: object[], error: string|null,
 *             lineNumbers: number[], rowErrors: {index: number, message: string}[] }}
 */
export function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const empty = { headers: [], rows: [], lineNumbers: [], rowErrors: [] };

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
    return { ...empty, error: UNREADABLE_ERROR };
  }

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = (result.meta.fields || []).filter(Boolean);
  if (!headers.length) {
    return { ...empty, error: 'File has no header row.' };
  }
  // Binary content that happens to contain no NUL/replacement byte can still
  // land here with a header full of control characters (e.g. a zip's local
  // file signature); reject that too.
  if (headers.some((h) => CONTROL_CHAR.test(h))) {
    return { ...empty, error: UNREADABLE_ERROR };
  }

  // Row-level problems (a stray unquoted comma, an unterminated quote, ...)
  // Papaparse noticed while parsing individual rows, and each surviving
  // row's true spreadsheet line number (see computeTrueLines above).
  const rowProblems = collectRowProblems(result.errors, result.data.length);
  const trueLines = computeTrueLines(text, result.data.length);

  // A row of nothing but empty strings is padding, not data.
  const rows = [];
  const lineNumbers = [];
  const rowErrors = [];
  result.data.forEach((row, i) => {
    if (!Object.values(row).some((v) => String(v ?? '').trim() !== '')) return;
    rows.push(row);
    lineNumbers.push(trueLines[i]);
    if (rowProblems.has(i)) {
      rowErrors.push({ index: rows.length - 1, message: rowProblems.get(i) });
    }
  });

  if (!rows.length) {
    return { ...empty, headers, error: 'File has no data rows.' };
  }
  if (rows.length > MAX_ROWS) {
    return { ...empty, headers, error: `File has ${rows.length} rows. The maximum is ${MAX_ROWS}.` };
  }

  return { headers, rows, error: null, lineNumbers, rowErrors };
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
 * @param {object}   rowMeta         optional, from parseCsv:
 *   { lineNumbers: number[], rowErrors: {index, message}[] } — each row's
 *   true spreadsheet line, and any Papaparse row-level parse problem.
 *   Falls back to plain `index + 2` numbering and no parse problems when
 *   omitted, so callers that only have `rows`/`headers` still work.
 * @returns {{ fileError: string|null, valid: object[], errors: object[],
 *             warnings: object[], unknownColumns: string[],
 *             erroredRowCount: number }}
 */
export function validateRows(rows, headers, categoryIds, existingNames = [], rowMeta = {}) {
  const missing = COLUMNS.filter((c) => c.required && !headers.includes(c.name)).map((c) => c.name);
  if (missing.length) {
    return {
      fileError: `Required column${missing.length > 1 ? 's' : ''} missing from the header: ${missing.join(', ')}.`,
      valid: [], errors: [], warnings: [], unknownColumns: [], erroredRowCount: 0,
    };
  }

  const { lineNumbers = [], rowErrors: parseProblems = [] } = rowMeta;
  const parseProblemByIndex = new Map(parseProblems.map((p) => [p.index, p.message]));

  const unknownColumns = headers.filter((h) => !COLUMN_NAMES.includes(h));
  const known = new Set(existingNames.map((n) => n.toLowerCase()));
  const seen = new Map();

  const valid = [];
  const errors = [];
  const warnings = [];
  let erroredRowCount = 0;

  rows.forEach((row, index) => {
    // Spreadsheet numbering: the header occupies row 1. Prefer the true
    // line Papaparse reported (lineNumbers can skip ahead over blank lines
    // that were dropped before this array was built); fall back to plain
    // sequential numbering when the caller didn't supply it.
    const rowNumber = lineNumbers[index] ?? (index + 2);

    // A row Papaparse itself couldn't parse cleanly (an unquoted delimiter
    // that split it into the wrong number of fields, an unterminated
    // quote, ...) is structurally unreliable — its fields may be shifted
    // or its data lost. Report it and skip it, rather than validating
    // fields that don't mean what their column header says they mean.
    if (parseProblemByIndex.has(index)) {
      errors.push({ row: rowNumber, column: '', value: '', message: parseProblemByIndex.get(index) });
      erroredRowCount += 1;
      return;
    }

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
      erroredRowCount += 1;
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

  return { fileError: null, valid, errors, warnings, unknownColumns, erroredRowCount };
}

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
  return `\uFEFF${header}\n${body}\n`;
}
