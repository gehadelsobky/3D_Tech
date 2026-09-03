# Product CSV Import — Design

| | |
|---|---|
| **Date** | 2026-09-03 |
| **Status** | Approved — ready for implementation planning |
| **Scope** | Bulk-create products from a CSV file, from the admin panel |

## 1. Problem

Products can only be created one at a time through the admin form. Seeding a
catalogue, or adding a supplier's new range, means repeating a 21-field form
for every item. The panel already exports products to CSV; there is no way back
in.

A naive import is dangerous in three specific ways, and this design exists to
close them:

- **It can destroy data.** An import that updates or deletes has no undo.
- **It can silently drop Arabic.** The existing export carries 12 of 25
  columns and **none** of the seven Arabic fields. Round-tripping
  export → edit → import would erase bilingual content without a warning.
- **It closes a formula-injection loop.** `toCSV` in `server/routes/export.js`
  emits cell values verbatim. Verified: a product named `=cmd|'/c calc'!A1`
  exports as `"=cmd|'/c calc'!A1"`, which executes when the file is opened in
  Excel. Today someone must already have that value in the database. An import
  endpoint is the missing write half of that chain.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Create vs update | **Insert only** | Cannot modify or delete anything. Worst case is duplicate rows the admin deletes. |
| Failure handling | **Two-step: preview, then confirm** | Nothing is written until the admin has seen the report and pressed a button. |
| Template columns | **All 21, Arabic included** | The site is bilingual; an English-only import leaves a manual second pass per product. |
| Architecture | **Stateless, file re-uploaded on confirm** | No staging table, no temp files, no expiry, no cleanup. Re-validating on commit is a security property, not a cost. |
| Schema change | **None** | Uses existing columns only. |
| Webhooks | **No per-row `product.created`** | Importing 500 products would fire 500 webhooks at the customer's endpoint. Documented as a deliberate difference from `POST /api/products`. Revisit if a summary event is wanted. |

## 3. Architecture

### New files

**`server/productImport.js`** — pure module, no HTTP and no database access, so
it can be tested in isolation. Follows the pattern of `sla.js`,
`passwordReset.js`, and `permissions.js`.

```
COLUMNS                     column spec: name, required, type, rules
parseCsv(buffer)            bytes → rows
validateRows(rows, cats)    rows + valid category ids → { valid, errors, warnings }
buildTemplate(categories)   → CSV template string
```

**`server/routes/import.js`**

| Endpoint | Permission | Behaviour |
|---|---|---|
| `GET /api/import/products/template` | `products.create` | Download the template |
| `POST /api/import/products/preview` | `products.create` | Parse, validate, return report. **Writes nothing.** |
| `POST /api/import/products` | `products.create` | Re-parse, re-validate, insert valid rows in one transaction |

**`src/components/ImportProducts.jsx`** — its own component rather than more
code in `Admin.jsx`, which is already ~4000 lines.

### Modified files

- `server/index.js` — mount the route (one line)
- `server/routes/export.js` — escape formula-injection prefixes on export
- `src/pages/Admin.jsx` — an "Import CSV" button beside "Export CSV"
- `src/i18n/en.js`, `src/i18n/ar.js` — UI strings
- `package.json` — add `papaparse` (zero transitive dependencies)

### Untouched

`server/routes/products.js`, `server/routes/upload.js`, and the `products`
table schema. Import writes through its own path; existing create, update, and
delete behaviour is unchanged.

### Why a CSV library

Hand-rolling RFC 4180 parsing is a known trap: quoted fields, commas and
newlines inside cells, escaped quotes, BOM, CRLF. The project's own export
writes quoted fields with a BOM, so a naive `split(',')` would fail on the
system's own output.

## 4. Data flow

```
1. Admin downloads template        GET  /api/import/products/template
2. Admin fills it in Excel
3. Admin uploads                   POST /api/import/products/preview
   → parse → validate → report { rowCount, valid, errors, warnings,
                                 preview[5], fingerprint }
   → nothing written
4. Admin reviews and confirms      POST /api/import/products  (file + fingerprint)
   → fingerprint must match → re-parse → re-validate
   → insert valid rows in one transaction
   → { imported: 17 }
```

The file is uploaded twice. That is deliberate: the confirm step trusts nothing
from the preview response, so a tampered client cannot smuggle a row past
validation. The fingerprint (SHA-256 of the uploaded bytes) prevents previewing
one file and confirming another.

## 5. Columns

Order does not matter; headers are matched by name, case-insensitively, trimmed.

**Required (2)**

| Column | Rule |
|---|---|
| `name` | Non-empty, ≤ 200 characters |
| `category` | Must be an existing category id; the error lists valid ids |

**Numbers (4)**

| Column | Rule |
|---|---|
| `moq` | Integer ≥ 1 (blank → 50) |
| `price_min` | Number ≥ 0 |
| `price_max` | Number ≥ 0, and ≥ `price_min` |
| `lead_days` | Integer ≥ 0 |

`price_min`, `price_max`, and `lead_days` drive Gift Finder scoring. A product
missing them cannot be recommended — reported as a warning, not an error.

**Lists (6)** — `features`, `features_ar`, `branding_options`,
`branding_options_ar`, `tags`, `images`

Pipe-separated: `Durable|Waterproof|2-year warranty`. A comma is the CSV
delimiter, a semicolon is the delimiter in European Excel, and JSON is
unpleasant to type by hand. A cell starting with `[` is also accepted as JSON,
so a file exported from this system (where `tags` is JSON) stays importable.

**Optional text (9)** — `name_ar`, `description`, `description_ar`,
`lead_time`, `lead_time_ar`, `price_range`, `price_range_ar`, `notes`,
`notes_ar`

Every Arabic column is optional. Empty means the site falls back to English at
render time, consistent with the project's bilingual rule.

### `images`

Accepted: a relative `/uploads/...` path, or an `https://` URL.
Rejected: `javascript:`, `data:`, and `http://`. The last because the site's CSP
allows `https:` only — an `http://` image would be blocked by the browser and
render as an empty box.

## 6. Validation report

**File-level errors — the whole file is rejected**

- `name` or `category` missing from the header
- More than 1000 rows
- Not parseable as CSV

**Unknown columns are a warning, not an error.** The report names them and
says they will be ignored. Rejecting a file over a stray `colour` column would
be hostile.

**Row-level errors — that row is skipped**

```
Row 4  · category  · "usbb"  → Category does not exist. Valid: 3d-printing, usb, …
Row 9  · moq       · "many"  → Must be a whole number ≥ 1
Row 12 · name      · empty   → Required
Row 15 · price_max · "50"    → Must be ≥ price_min (90)
```

**Warnings — the row still imports**

- Name duplicated within the file
- Name already exists in the catalogue (important under insert-only: this is
  what stops an admin re-uploading the same file and doubling the catalogue)
- No `price_min` → will not appear in Gift Finder results
- No `images` → will use the placeholder image

Empty rows are skipped silently.

### Template

Generated dynamically rather than served as a static file, so the category ids
in the examples are always the current ones. Contains the header row, one full
bilingual example, one minimal example, and a UTF-8 BOM so Excel reads Arabic
correctly — the same thing the export does.

## 7. Security

**Upload** — a multer instance separate from the image uploader:

```
memoryStorage        the file never touches disk
fileSize: 5 MB       matches the existing image uploader's limit
files: 1
```

5 MB, not 2: a full 1000-row file of 21 columns is about 1 MB in English but
about 2 MB in Arabic, since UTF-8 spends two bytes per Arabic character. A 2 MB
cap would have rejected legitimate bilingual files at the row limit. **The row
cap, not the byte cap, is the real bound on work.**

`memoryStorage` means no temp file to clean up, no path traversal, and nothing
that could be served back. The buffer is parsed and discarded.

**Type checking** — `.csv` extension required; MIME accepted from a broad list
(`text/csv`, `application/vnd.ms-excel`, `text/plain`,
`application/octet-stream`) because browsers disagree. The real check is that
the content parses as CSV and carries the expected headers. Magic bytes do not
apply to text.

**Limits** — 1000 rows, 5000 characters per cell.

**Formula injection — fixed on both sides, with different rules**

- **Export** escapes every cell beginning with `=`, `+`, `-`, `@`, tab, or CR
  by prefixing `'`. This is where the danger actually is, so the rule here is
  the broad, standard one.
- **Import** rejects only cells beginning with `=` or `@`. The broad rule
  applied on input would reject ordinary product copy: `-20% discount`,
  `+2 year warranty`, `- Durable finish` all begin with a listed character and
  are entirely legitimate. Nothing a product is legitimately called begins with
  `=` or `@`, so the narrow rule is defence in depth without false positives.

Export escaping is the fix; import rejection is the second layer.

**Re-validation on confirm** — the commit endpoint re-parses and re-validates
from the uploaded bytes and ignores any row list the client sends.

**Transaction** — all valid rows insert inside one `db.transaction()`. A failure
part-way leaves no products behind.

**Ordering** — the first imported product takes `MAX(sort_order) + 1` and each
subsequent row increments by one, so a file's rows keep their order and land at
the end of the catalogue. Consistent with how `POST /api/products` behaves, and
it means an import never reshuffles what visitors already see.

**No stored-XSS path** — verified: product fields render as plain text in React.
The only `dangerouslySetInnerHTML` in the codebase is in `BlogPost.jsx` and is
DOMPurify-sanitised.

**Authorisation** — all three endpoints require `products.create`, which the
seeded Editor role holds. If import should be restricted further, that is a
role-configuration change, not a code change.

## 8. UI

An "Import CSV" button beside the existing "Export CSV" opens a panel:

```
Import products
Start from the template so your columns match.
[ ⬇ Download CSV template ]

[ Choose file… ]  products.csv
[ Validate file ]
```

After validation:

```
20 rows · 17 ready · 3 with errors

⚠ Unknown column "colour" — will be ignored

✗ Row 4  · category  · Category "usbb" does not exist
✗ Row 9  · moq       · "many" must be a whole number
✗ Row 12 · name      · Required
⚠ Row 7  · Name already exists in the catalogue

Preview of the first 5 products to be added:
  Custom USB Drive · usb · MOQ 50
  …

[ Cancel ]                    [ Import 17 products ]
```

Deliberate choices:

- The action button states the exact count, not "Confirm".
- Errors before warnings; each carries row number, column, and the offending
  value, so the admin can jump straight to that line in Excel.
- A five-product preview of the parsed result, to build confidence before any
  write.
- With zero valid rows the import button is disabled.
- The template button sits above file selection in reading order, so a
  first-time user meets it before making a malformed file.
- Both languages, like the rest of the panel.

## 9. Testing

`productImport.js` is testable without a server or database:

| Case | Expected |
|---|---|
| A file exported by this system | Parses (quotes, BOM, JSON `tags`) |
| Comma and newline inside a quoted cell | Parses correctly |
| Category that does not exist | Row error listing valid ids |
| `moq` as text | Row error |
| `price_max` < `price_min` | Row error |
| Cell starting with `=` or `@` | Rejected |
| Cell starting with `-20%` or `+2 year` | Accepted (not a formula) |
| `javascript:` in `images` | Rejected |
| Unknown column | Warning; file still processes |
| `name` missing from header | File rejected |
| 1001 rows | File rejected |
| Blank rows | Skipped silently |
| Empty Arabic columns | Accepted; falls back to English |

Route-level checks: preview writes nothing (product count unchanged before and
after), confirm inserts exactly the valid count, a mismatched fingerprint is
rejected, and a caller without `products.create` gets 403.

## 10. Out of scope

- Updating or deleting existing products through import
- Importing categories, blog posts, or users
- Image upload through CSV (URLs and existing `/uploads/...` paths only)
- Scheduled or API-driven imports
- Undo — insert-only means deleting the new rows is the undo
