# Business Requirements Document — 3DTECH Website & Admin Portal

| | |
|---|---|
| **Product** | 3DTECH corporate website + content/lead management portal |
| **Version** | 1.0 (reverse-engineered baseline) |
| **Date** | 2026-09-02 |
| **Owner** | Gehad El-Sobky |
| **Status** | ⚠️ **Draft — needs business sign-off.** See §12 Open Questions. |

> **How this document was produced.** No BRD existed for this project. This
> document was reconstructed by reading the shipped source code
> (`server/`, `src/`) and describes the system **as it is actually built
> today**. Everything under "Requirements" is verified against code.
> Anything inferred rather than verified is tagged **[ASSUMED]** and must
> be confirmed or corrected by the business owner.

---

## 1. Business Context

**3DTECH** is an Egyptian company specialising in 3D printing and customised
corporate gifts, founded 2019 and operating out of Cairo. It serves clients
across real estate, pharmaceuticals, education, energy, and services.

**Positioning:** "Turn ideas into tangible products with clear quality and
structured execution."

**Two revenue lines:**

1. **3D Printing Services** — engineering/architectural models, product
   prototyping, custom mechanical parts, educational and graduation projects,
   decorative and artistic pieces.
2. **Corporate Gifts & Branded Giveaways** — year-end gifts, employee welcome
   kits, event and exhibition giveaways, awards and trophies, seasonal
   (Ramadan / New Year) gifts.

**Market claims used on the site:** 500+ projects delivered, 50+ corporate
clients, 10+ 3D printers, 24-hour quote turnaround, 100% custom designs.

**Contact of record:** info@3dtecheg.com · +20 101 855 9479 · +20 100 544 9959 ·
Cairo, Egypt.

---

## 2. Business Objective

The website is a **lead-generation and credibility asset**, not an e-commerce
store. There is no cart, no checkout, and no online payment anywhere in the
system — by design.

The commercial funnel is:

```
Visitor → browses catalogue / uses Gift Finder → submits a quote request
        → lead lands in the admin portal + email + webhook
        → sales team responds within 24 hours (stated SLA)
```

**Primary success measure [ASSUMED]:** volume and quality of quote requests
(`form_submissions`), which the built-in analytics dashboard already tracks by
month, week, status, form, and most-requested product.

---

## 3. Users & Roles

### 3.1 External users
| User | Need |
|---|---|
| Corporate buyer / procurement | Evaluate capability, find a suitable gift, request a quote |
| Startup / engineering client | Understand prototyping and custom-part services |
| Student | Graduation project and educational model services |
| Arabic-speaking visitor | Full experience in Arabic with correct RTL layout |

### 3.2 Internal users (system roles)

Three roles are seeded; custom roles can be created at runtime.

| Role | Slug | System | Access |
|---|---|---|---|
| **Super Admin** | `super_admin` | Yes | **All permissions, unconditionally.** Bypasses every permission check in code; owns role management, SMTP, backups, API keys, webhooks. |
| **Admin** | `admin` | No | Products (full), Users (view/create/edit — **not delete**), Gift Settings, Pages, Forms (full), Files (full). **No** role management, **no** SMTP, **no** backup, **no** integrations. |
| **Editor** | `editor` | No | Content only: Products (view/create/edit — **not delete**), Gift Settings (view only), Pages, Forms (view/create/edit — **not delete**), file upload (**not delete**). |

**Rule:** only Super Admin is `is_system`; permissions for non-system roles are
resolved from the database on **every request**, so a permission change takes
effect immediately without re-login.

**Rule:** Admin and Editor permission sets are re-applied on every server boot
(`migrateRolePermissions()`), so hand-edits to those two roles are overwritten.
Custom roles are not touched.

### 3.3 Permission catalogue (25 permissions, 8 groups)

`products.{view,create,edit,delete}` · `users.{view,create,edit,delete}` ·
`gift_settings.{view,edit}` · `roles.manage` · `pages.{view,edit}` ·
`forms.{view,create,edit,delete}` · `settings.{smtp,backup}` ·
`api_keys.{view,manage}` · `webhooks.{view,manage}` · `files.{upload,delete}`

---

## 4. Functional Requirements — Public Website

### FR-1 Navigation & pages
Public routes: `/` · `/products` · `/products/:id` · `/request/:id` ·
`/gift-finder` · `/services` · `/about` · `/contact` · `/privacy` · `/blog` ·
`/blog/:slug` · `/page/:slug` (custom) · `/form/:slug` (standalone form) ·
`/login` · `/admin` (protected).

- **FR-1.1** Core pages (`home`, `about`, `contact`, `products`) can be
  **hidden** from the admin but **never deleted**. A hidden page returns the
  404 view to visitors. `global` can neither be hidden nor deleted.
- **FR-1.2** Admins can create unlimited **custom pages** served at
  `/page/:slug`. Slugs are auto-sanitised to lowercase alphanumeric + hyphens
  and must be unique.

### FR-2 Product catalogue
- **FR-2.1** Products are grouped into **11 seeded categories**: 3D Printing,
  USB & Flash Drives, Chargers & Power Banks, Gift Sets, Notebooks & Organizers,
  Desk Accessories, Drinkware, Eco-Friendly, Keychains & Coasters,
  Awards & Trophies, Bags. Categories are admin-managed (name, icon,
  description, sort order, active flag) in both languages.
- **FR-2.2** Each product carries: images gallery, description, features list,
  **branding options**, **MOQ** (default 50), lead time, price range, tags,
  and internal notes — plus machine-readable `price_min`, `price_max`,
  `lead_days` used by the Gift Finder.
- **FR-2.3** Products are browsable with search and category filtering.
- **FR-2.5** **Display order is admin-controlled.** Both categories and products
  carry a `sort_order`; the public API returns them in that order and the panel
  reorders them with up/down arrows plus a typed position box. Ordering is a
  single global sequence per list — filtering by category preserves the relative
  order rather than needing a second ordering scheme. The homepage Featured
  Products are simply the first four in catalogue order, so the same control
  chooses them. A new product or category is appended to the end, never inserted
  at the front. Saving renumbers the whole list from 0, so deletes leave no gaps.
- **FR-2.4** **No prices are transacted.** `price_range` is indicative copy
  only; every purchase path ends in a quote request.

### FR-3 Gift Finder (differentiating feature)
A 5-step wizard that recommends products. Steps, in order:
**occasion → budget → audience → quantity → delivery timeline.**

- **FR-3.1** Every option list is **admin-editable at runtime** (gift types,
  budget ranges, audience types, quantity ranges, delivery timeframes) — no
  code change needed to retune the wizard.
- **FR-3.2** Recommendation scoring (weights approved 2026-09-02):

  | Signal | Points |
  |---|---|
  | Price fits inside the chosen budget band | **6** |
  | Price ceiling under budget ceiling (partial fit) | 2 |
  | Lead time meets the chosen delivery window | **2** |
  | Category is mapped to the chosen audience | **2** |
  | Per matching gift-type tag | **1 each** |
  | MOQ within the chosen quantity | **1** |

  Budget is deliberately the heaviest signal: a product outside the customer's
  budget must not outrank one inside it on secondary signals alone.

- **FR-3.3** The number of recommendations is **admin-configurable**
  (`resultsCount` in Gift Settings, default 4, clamped to 1–24 both server-side
  and in the browser).

- **FR-3.6** **Approximate matches.** A product that misses the chosen budget
  **or** the chosen lead time is still shown, but flagged "Close to your
  request" / "قريب من طلبك" with the reason (over budget, or lead time longer
  than requested). Budget is reported first when both miss. Rationale: the
  visitor is never silently handed something that does not meet what they asked
  for.

- **FR-3.7** **No exact match.** When *no* returned product satisfies both
  budget and lead time, the results page leads with a call-to-action ("We
  couldn't find an exact match → Talk to us") linking to the quote form, with
  the approximate results shown underneath as "Closest Options". Rationale:
  a visitor we cannot serve from the catalogue is a lead, not a dead end.
- **FR-3.4** Two admin-editable mapping tables drive relevance:
  `audienceCategoryMap` (audience → categories) and `giftTagMap`
  (occasion → product tags).
- **FR-3.5** Arabic labels for wizard options come from an admin-managed
  `translations_ar` dictionary inside gift settings, falling back to English.

### FR-4 Lead capture (the commercial core)
- **FR-4.1** Two entry points write to the same `quote-request` form:
  the **general quote form** (`/contact`) and the **product-specific request**
  (`/request/:id`, tagged `formType: "product_request"`), letting the admin
  filter Product Requests vs General Quotes.
- **FR-4.2** Default required fields: **name, email, phone.** Optional:
  company, gift type, product interest, quantity, budget, desired delivery
  date, notes.
- **FR-4.3** On submission the system must, in order: validate required fields
  → persist the submission → emit the `form.submitted` webhook → email the
  internal notification address → email a confirmation to the submitter
  (only when the email field passes regex validation). Email and webhook
  failures are **fire-and-forget and must never fail the submission.**
- **FR-4.4** Anti-spam: a hidden **honeypot** field (`_hp`) causes the
  submission to be silently accepted and discarded, plus a hard limit of
  **10 submissions per 15 minutes per IP**.
- **FR-4.5** Submissions carry a workflow `status` (default `new`) and internal
  `notes`. The admin sidebar shows a live badge of `new` submissions.
- **FR-4.6** **Response SLA: 24 hours**, stated in customer-facing copy and
  now measured. Approved 2026-09-02; the value lives in `server/sla.js` and every
  surface reads it from there.
  - **FR-4.6.1** Moving a submission to `replied` stamps `replied_at` once. It is
    never overwritten, so cycling the status keeps the original response time.
  - **FR-4.6.2** The admin panel shows time-to-reply on each answered submission,
    time-waiting on each open one, and a red **⚠ Overdue** badge on any submission
    still `new` past the SLA. The dashboard carries an Overdue tile.
  - **FR-4.6.3** Analytics report average reply time, SLA compliance rate
    (% answered within the window), overdue count, and how many replies predate
    tracking (excluded from the average rather than counted as instant).
  - **FR-4.6.4** An hourly job (`server/sla-alert-cron.js`, PM2) emails the
    notification address a digest of breached submissions. Each is reported
    **once**; with no SMTP configured it logs and leaves them queued for when
    SMTP is set up.
  - **FR-4.6.5** Submission status is restricted to `new`, `read`, `replied`,
    `archived`; any other value is rejected with 400.

### FR-5 Blog
Posts have a draft/published status, cover image, author, tags, excerpt, and
slug. Only `published` posts are publicly visible or listed in the sitemap.

### FR-6 Client logos
An admin-managed logo marquee (name, Arabic name, logo URL) rendered as a
seamless auto-scrolling band; the section is hidden entirely when no logos are
configured.

---

## 5. Functional Requirements — Admin Portal

Single-page admin at `/admin`, gated by login. Tabs render **only** if the
signed-in role holds the matching permission.

| Tab | Gate | Capability |
|---|---|---|
| Dashboard | always | Counts (products, categories, users, forms, submissions, new) + recent activity + analytics charts |
| Products | `products.view` | Full CRUD, image upload, bilingual fields |
| Gift Settings | `gift_settings.view` | Edit every Gift Finder option, mapping table, and Arabic dictionary |
| Users | `users.view` | Manage admin accounts and role assignment |
| Roles | `roles.manage` | Create custom roles, toggle any of the 25 permissions |
| Pages | `pages.edit` | Edit all page copy (EN + AR), create/delete custom pages, toggle visibility |
| Categories | `products.view` | CRUD, icon, sort order, bilingual |
| Forms | `forms.view` | Form builder + submissions inbox (badge = new count) |
| Blog | `pages.edit` | Post CRUD, publish/draft, bilingual |
| Header & Footer | `pages.edit` | Navigation, contact block, social links (Facebook, Instagram, LinkedIn, X) |
| Client Logos | `pages.edit` | Marquee management |
| Settings | `settings.smtp` | SMTP config + test connection + test email; backups |
| Integrations | `api_keys.view` or `webhooks.view` | API keys and webhooks |

### FR-6.5 Password reset
Approved 2026-09-02. An admin who forgets their password recovers it by email,
without another admin's help.

- **FR-6.5.1** From the login page, an admin submits the email address on their
  account and receives a single-use reset link.
- **FR-6.5.2** The link **expires after 30 minutes** (`RESET_TOKEN_TTL_MINUTES`
  in `server/passwordReset.js`) and is invalidated the moment it is used.
  Requesting a new link kills any link already outstanding for that account.
- **FR-6.5.3** The request endpoint answers **identically whether or not the
  address belongs to an account** — it must not become a way to discover which
  addresses are admins.
- **FR-6.5.4** Only the SHA-256 hash of the token is stored. A leaked database
  cannot be used to reset anyone's password.
- **FR-6.5.5** Reset links are built from the configured `PUBLIC_URL`, never
  from the request's `Host` header, which is attacker-controlled. In production
  with `PUBLIC_URL` unset the server logs an error and declines to send.
- **FR-6.5.6** Limits: 5 link requests per hour per IP, 10 submissions per hour.
  Checking whether a link is still live is not counted — it sends nothing and
  changes nothing, and counting it would lock a visitor out of their own reset.
- **FR-6.5.7** New passwords must be at least 8 characters, matching the rest of
  the system.
- **FR-6.5.8** **Prerequisite:** the account must have an email address, and
  SMTP must be configured. An admin with no email on file cannot use this route.
- **FR-6.5.9** **Changing a password ends existing sessions.** Every account
  carries a `token_version`; sessions are stamped with the version they were
  issued under, and any password change moves it forward.
  - A reset through the emailed link signs out **every** session — that is the
    point when the reason for resetting is a suspected compromise.
  - Changing your own password from My Account signs out every **other**
    session; the API returns a replacement token so the person making the
    change is not signed out of the session they are using.
  - An admin setting another user's password signs that user out everywhere.
    Editing their name, email, or role does **not**.
  - Sessions issued before this existed carry no version and are treated as
    version 0, so deploying does not sign everyone out.

### FR-7 Form builder
Admins define arbitrary forms — field name, label, type
(`text`/`email`/`tel`/`select`/`date`/`textarea`), required flag, placeholder,
options — plus success title, success message, and submit button label. Each
form is publicly reachable at `/form/:slug` and can be deactivated.

### FR-8 Analytics
Submissions per month (12 months), per week (8 weeks), status breakdown,
per-form performance, and top 5 most-requested products.

### FR-9 Data export
CSV export of products, submissions, users, and blog posts, each gated by the
matching view permission.

### FR-10 Backup
Manual and scheduled SQLite snapshots (`db.backup()`, safe while the database is
in use), listable and downloadable — gated on `settings.backup` (**Super Admin
only** in the seeded role set). Manual backups retain the last 10; the daily
cron retains 30.

---

## 6. Bilingual Requirements (EN / AR)

This is a **first-class requirement**, not a translation layer bolted on.

- **BR-1** Default language is **English**; the visitor's choice persists in
  `localStorage`.
- **BR-2** Selecting Arabic sets `dir="rtl"` and `lang="ar"` on `<html>`; the
  whole layout must mirror.
- **BR-3** UI chrome is translated via static dictionaries
  (`src/i18n/en.js`, `src/i18n/ar.js` — 16 sections, kept line-for-line in
  sync). A missing Arabic key **falls back to English**, never to a blank or a
  raw key.
- **BR-4** Business content is bilingual **in the database**, via parallel
  `*_ar` columns on products (7 fields), categories (2), blog posts (3), and
  page content (`content_ar`).
- **BR-5** Arabic is **optional per field.** An empty Arabic value falls back
  to English at render time, so partial translation never breaks a page.
- **BR-6** Arabic content is stored in its **own column** — never nested
  inside the English JSON blob.

---

## 7. Non-Functional Requirements

### NFR-1 Security
- JWT bearer authentication; **`JWT_SECRET` is mandatory in production — the
  server refuses to boot without it.**
- Passwords hashed with bcrypt, cost 12. The first-run admin password is
  randomly generated and printed **once**.
- Tokens are re-validated per request: user must still exist, role must still
  exist, permissions re-read from the database.
- Helmet CSP: scripts self-only; YouTube and Vimeo the only allowed frames.
- Rate limits: **100 req/min per IP** globally on `/api`, **5 login attempts
  per 15 min**, **10 form submissions per 15 min**.
- CORS restricted by `CORS_ORIGINS` in production.
- 1 MB request body cap. HTML sanitised with DOMPurify.
- Password reset tokens are 256-bit, stored hashed, single-use, and expire in
  30 minutes. Changing a password invalidates outstanding sessions through the
  account's `token_version` (FR-6.5.9).
- 500-level errors never leak internals to the client.

### NFR-2 Performance
- Route-level code splitting (every page is a lazy chunk).
- Gzip/Brotli compression on all responses.
- Cache policy: hashed Vite assets `immutable` for 1 year, static build 7 days,
  uploads 1 day.
- 12 database indexes on the hot paths (submissions, blog slug/status, product
  category, role permissions, API key lookup, webhook deliveries).

### NFR-3 SEO
- Dynamically generated `/sitemap.xml` covering static pages, all products,
  **published** blog posts, and visible custom pages, with per-section
  `changefreq` and priority.
- Per-page meta via a shared `SEO` component.

### NFR-4 Reliability
- `/api/health` returns status, uptime, and a live database probe.
- Hourly overdue-submission alert (`server/sla-alert-cron.js`, PM2), reporting
  each breach once.
- React error boundaries prevent a component failure from blanking the site.
- Automated daily backup at 02:00 (`server/backup-cron.js`, scheduled by PM2 in
  `ecosystem.config.cjs`), retaining the last 30 snapshots in `server/backups/`.
  **Same-disk only — no off-site copy.**
- The database self-migrates on boot — schema changes are additive
  (`ALTER TABLE … IF NOT EXISTS` guards), and seeding only runs on empty tables,
  so a restart is always safe.

---

## 8. Data Model

14 tables in SQLite (`server/data.db`):

`products` · `categories` · `gift_settings` (single row, id=1) · `roles` ·
`role_permissions` · `form_definitions` · `form_submissions` · `app_settings`
(key/value: `smtp`, `pages_meta`, …) · `page_content` · `blog_posts` ·
`api_keys` · `webhooks` · `webhook_deliveries` · `users`.

Design decisions worth preserving:
- Flexible content (page copy, gift settings, form fields, form submissions) is
  stored as **JSON blobs** so the business can restructure content without a
  migration.
- `page_content` is keyed by **slug**, not a numeric id.
- Categories use human-readable **string ids** (`usb`, `gift-sets`, …), which is
  what the Gift Finder mapping tables reference.

---

## 9. Integrations

- **SMTP** — configurable from the UI (host, port, security) or environment, with
  a connection test and a test-send. Presets include Gmail.
- **Webhooks** — 5 events: `form.submitted`, `product.created`,
  `product.updated`, `product.deleted`, `blog.published`. Each webhook has a
  shared secret, a delivery log with response status and attempt count, and a
  manual test trigger.
- **API keys** — hashed at rest with a visible prefix, scoped to a subset of the
  25 permissions, revocable, with last-used tracking.

---

## 10. Explicitly Out of Scope

Confirmed absent from the codebase and **intentionally not built**:

- E-commerce: cart, checkout, payment gateway, order management.
- Customer accounts — `users` are staff only; there is no public registration.
- Inventory or stock tracking.
- Shipping or logistics integration.
- Multi-currency (prices are indicative EGP copy only).
- Live chat / WhatsApp widget.
- Third-party analytics (Google Analytics, Meta Pixel) — measurement is the
  built-in dashboard only.
- Languages beyond English and Arabic.

---

## 11. Deployment

Node + Express serving the built Vite SPA from `dist/`, behind nginx, managed by
PM2 (`ecosystem.config.cjs`), deployed via `deploy.sh`. API on port 3001 by
default. Full runbook in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 12. Open Questions — Require Business Sign-Off

These could not be determined from code. Each needs an answer from the owner.

1. **Success metrics.** What is the actual monthly target for quote requests?
   What counts as a qualified lead? §2 currently records an assumption.
2. ~~**The 24-hour SLA.**~~ **RESOLVED 2026-09-02:** treated as a real
   operational commitment. Reply time is now recorded, surfaced in the panel and
   analytics, and breaches trigger an hourly email digest. See FR-4.6.
3. ~~**Gift Finder weights.**~~ **RESOLVED 2026-09-02:** budget stays a soft
   signal but its weight was raised 3 → 6 so it outranks the secondary signals.
   Implemented in `SCORE_WEIGHTS` in `src/pages/GiftFinder.jsx`.
4. ~~**Top-4 results.**~~ **RESOLVED 2026-09-02:** the count is now
   admin-editable (default 4). Weak matches are shown with a "Close to your
   request" badge and a reason rather than hidden, and a "Talk to us" CTA takes
   over when nothing matches exactly. See FR-3.3, FR-3.6, FR-3.7.
4b. **Lead-time data (NEW, unresolved).** No product in the catalogue has a
    lead time under 21 days, so the wizard's "Within 1 week" and "1-2 weeks"
    options can never be satisfied — every result comes back as an approximate
    match and the "Talk to us" CTA fires. Either the delivery options need to
    match reality (3 weeks / 1 month / 1 month+), or the products' `lead_days`
    values are stale and need updating. **Business decision required.**
4c. ~~**Session invalidation after a password reset.**~~ **RESOLVED
    2026-09-03:** implemented via `token_version` on the account. See FR-6.5.9.
5. **Marketing claims.** Are 500+ projects / 50+ clients / 10+ printers current
   and defensible? They are static content today and will go stale.
6. **Arabic coverage.** Is a fully-translated Arabic catalogue required, or is
   English fallback acceptable indefinitely? This changes content workload
   significantly.
7. **Role model.** Should Admin really be unable to delete users, and Editor
   unable to delete products? Both look deliberate — please confirm.
8. **Data retention.** How long are form submissions with customer PII kept?
   The privacy policy grants a deletion right, but there is no retention policy
   or automated purge.
9. **Privacy policy.** Was it reviewed by a lawyer, and does the business need
   GDPR compliance (EU clients) as well as Egyptian data-protection law?
10. **Off-site backups.** Snapshots run daily at 02:00 via PM2 into
    `server/backups/` (30 kept; manual backups keep 10) — but they sit on the
    **same server and same disk as the live database**. A server loss loses the
    backups too. Is an off-site copy (S3 / Drive / another host) required?

---

## Appendix — Verification

Every "Requirement" statement above was read from source on 2026-09-02:

| Area | Source |
|---|---|
| Roles, permissions, seeding | `server/permissions.js`, `server/db.js` |
| Auth, JWT, permission checks | `server/middleware/auth.js` |
| Security, rate limits, sitemap, analytics | `server/index.js` |
| Lead capture flow | `server/routes/forms.js` |
| Gift Finder scoring | `src/pages/GiftFinder.jsx` |
| Bilingual behaviour | `src/context/LanguageContext.jsx`, `src/hooks/useLocalized.js` |
| Page/content rules | `server/routes/pages.js`, `seedPageContent()` |
| Admin modules | `src/pages/Admin.jsx` |
| Company facts & copy | `seedPageContent()` `global` / `about` / `services` |
