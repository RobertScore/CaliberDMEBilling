# AI Paperwork Reader: How It Was Built (Rebuild Guide)

This guide explains the AI order intake built for Caliber DME Billing, step by step, so the same feature can
be rebuilt in another app. Part 1 is in plain words. Part 2 is the full technical recipe, with the real
source code, for the developer (or the Claude session) doing the rebuild.

> Generated from the Caliber code on {{DATE}} (branch `claude/phase-1-foundation`, commit `{{COMMIT}}`).
> All examples use fake data. No patient information is in this guide.

---

## Part 1: What it does, in plain words

1. **Paperwork comes in.** A fax, an email, an upload or a portal upload. Several files can arrive together
   as one "packet" (Rx, delivery ticket, RFA, chart notes, insurance card...). Packets are often 20+ pages
   of mixed documents.
2. **It's stored safely.** Each file is encrypted before it's saved. Nothing is filed to a patient yet.
   It lands in an **Inbox** with the status "Reading".
3. **The AI reads it** in the background (Claude, through Anthropic's API). It returns:
   - the patient's details (name, DOB, address, phone, SSN, employer...)
   - up to 3 insurances / claims (payer, claim #, member ID, date of injury, adjuster, authorization #...)
   - the ordering doctor, diagnosis codes and HCPCS codes it saw
   - **how the packet splits into documents**, first page to last page (e.g. "pages 4-6 = RFA"), and
     which pages are junk (cover sheets) or about a different person
   - for **every value**: how sure it is (high / medium / low) and **where on the paper it read it**
     (file, page, and a box around the writing)
   - plain-English notes on anything confusing (conflicting dates, other claims, cancelled items)
4. **A person reviews it** on one screen: the paper on the left, the form on the right.
   - Fields the AI filled have a **purple outline** and an "AI" tag with a sure/unsure dot.
   - **Clicking a field jumps the document** to the page and spot it was read from, with a highlight.
   - **Enter** (or the ✓ button) means "this matches the paper": the box turns **green** and the cursor
     moves to the next AI field.
   - **Changing** a value turns it **amber** and shows "AI read: …" under it, with an undo button.
   - Typed-by-hand fields get a gray "Typed" tag.
   - A bar at the top counts progress ("12 of 18 AI values checked · 1 corrected") with a **Check next** button.
   - The packet shows as a **colored page map** and **part cards** (type, pages, File / Set aside,
     Verified, split, join).
   - The app looks for an **existing patient** match (DOB, name, SSN last 4, phone, claim #) and shows
     "Strong match / Possible / Weak". A strong match must be dismissed on purpose before creating a new
     patient, so duplicates don't happen by accident.
5. **Filing.** The person picks "new patient" or "existing patient" and files. Each part of the packet is
   cut into its own PDF and attached to the patient. Pages set aside never reach the patient's file. The full
   packet stays with the Inbox item. A note is added to the account, for example "AI read 18 fields:
   15 checked as right, 2 corrected, 1 not checked." That gives an accuracy record for the AI over time.
6. **Nothing is saved until a person files it.** If the AI is off, busy or fails, the same screen works
   with the fields typed by hand.

### Before you copy this into another app: things to decide

- **Patient data and the BAA.** The AI reader sends the documents to Anthropic. Only turn it on for real
  patient data once **that company** (the one running the other app) has a signed BAA with Anthropic, and
  uses an API setup covered by it. The on/off switch in section 2.5 does exactly this.
- **Who owns what.** This code was written for Caliber DME Billing. Copying it into another company's
  software is a business decision between Caliber and that company. Please confirm it's OK.
- **Never move data between the two apps.** Rebuild the feature in the other app. Don't connect the two
  databases, or share files, keys or logins.
- **Fit to the other app.** Caliber keeps a separate database per client. If the other app has one company
  only, the "tenant" parts become simpler (one database, one key), but every other rule stays: encrypt
  files, audit every view, no patient details in logs.

### Cost (Anthropic API prices at the time of writing; check current pricing)

Per packet of about 5 pages, with `claude-opus-5-5` and effort "high": roughly **15-25¢**, plus 1-2¢
for the "where on the page" boxes. A 25-page packet is about 4-5 times that. Cheaper models work but
read handwriting less reliably: `claude-sonnet-5-5` about 6-11¢; `claude-haiku-5-5` under 1¢.

---

## Part 2: Technical recipe

### 2.1 Stack it was built on

TypeScript (strict) everywhere · Node + Express 5 · Zod v4 for every input · PostgreSQL with Drizzle ORM ·
React 19 + Vite + Tailwind + TanStack Query · Vitest + supertest · Playwright for screen checks.

Libraries added for this feature:

| Library | Version | Where it runs | Why |
|---|---|---|---|
| `@anthropic-ai/sdk` | {{V:@anthropic-ai/sdk}} | server | Calls Claude with structured (Zod) output |
| `pdf-lib` (MIT) | {{V:pdf-lib}} | server | Counts pages and cuts a packet into one PDF per document |
| `pdfjs-dist` (Apache-2.0) | {{V:pdfjs-dist}} | browser only | Draws PDF pages so the screen can jump to a page and highlight a box |
| `multer` | {{V:multer}} | server | Receives uploads in memory (25 MB per file, 20 files) |
| `lucide-react` | (existing) | browser | Icons |

```bash
npm install @anthropic-ai/sdk pdf-lib pdfjs-dist multer
npm install -D @types/multer
```

### 2.2 How the pieces fit

```
fax / email / upload / portal / API
        │  POST /api/intake  (multer, memory only)
        ▼
 storeFiles(): encrypt each file (AES-256-GCM, this client's key) → documents row (pageCount from pdf-lib)
 intake_items row, status "reading"
        │  runReader() in the background (the request returns right away)
        ▼
 readPaperwork(): Claude (if switched on) → else demo reader → else "manual"
   returns Extraction: fields {value, confidence, where}, insurances, codes, document types, sections, notes
 intake_items.status = "review", extraction saved as JSON
        │
        ▼
 GET /api/intake/:id  → item + documents + possible patient matches (findMatches)
 Review screen: PageViewer (pdf.js) | AiField form + PacketParts + match picker
        │  POST /api/intake/:id/complete  (Zod-validated)
        ▼
 create or update the patient · cut each part into its own PDF (pdf-lib) · set aside the rest
 account note with an accuracy line · intake_items.status = "done", field_review saved · audit entry
```

Rules the code follows (keep them):
- Nothing becomes part of a patient record until a person files it.
- The AI's output is a **suggestion**. Every value is shown with its source and must be checkable.
- Never log document content or field values. Error messages carry status codes, not data.
- The account note and the audit details carry **counts only**, never the values.
- Every view of a file is audited. The full packet stays with the Inbox item so a misfiled page about
  someone else never lands in another patient's documents.

### 2.3 Database

Two tables. For this feature we added `documents.page_count`, `parent_document_id`, `page_from`, `page_to` and `intake_items.field_review`; the rest existed already.

```ts
{{SNIPPET:shared/schema/tenant.ts|export const intakeItems|export const tasks}}
```

Migrations (Drizzle-generated SQL):

```sql
{{FILE:migrations/tenant/0003_document_pages.sql}}
{{FILE:migrations/tenant/0004_intake_field_review.sql}}
```

The `intake.process` permission guards every intake route (given to Biller and above).

### 2.4 The shared contract: what the reader returns

This file is used by both the server (to validate Claude's answer) and the screens. The Zod schema
**is** the output format Claude is forced to follow: the SDK turns it into a JSON schema, and the API
guarantees the answer fits it.

```ts
{{FILE:shared/documents.ts}}
```

Key design choices:
- Every field is `{ value, confidence, where }`. `value: null` means "not on the paper". The prompt
  forbids guessing.
- `where.box` uses **fractions of the page** (0-1, top-left origin), so it works at any zoom level.
  It's an estimate: good enough to jump to the right spot, not a measurement.
- `sections` describes the whole packet page by page, with `belongsTo` to catch junk and misfiled pages.

### 2.5 The reader (Claude call, prompt, on/off switch, fallbacks)

```ts
{{FILE:server/lib/reader.ts}}
```

Notes:
- **On/off switch.** `CALIBER_AI_READER=off` pauses it anywhere. In production it also needs
  `CALIBER_AI_BAA_CONFIRMED=yes`. Rename these for the other app (e.g. `APP_AI_READER`).
- **Request shape.** One user message: for each file, a text label `File i: name`, then the PDF as a
  `document` block (or an image as an `image` block), then a closing instruction. PDFs go in whole:
  Claude sees both the text and the page images, which is what makes handwriting and page positions work.
- **Structured output.** `client.beta.messages.parse` with `output_config.format = betaZodOutputFormat(extraction)`
  returns `parsed_output` already validated against the schema.
- **Model and effort.** `claude-opus-5-5`, `effort: "high"`, `max_tokens: 16000`. With
  `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, Anthropic retries on a
  fallback model if the main one is overloaded.
- **Refusals and failures** never break the screen. The item still goes to "review", with a plain-English
  message, and the person types the fields.
- **Supported types** for the AI: PDF, PNG, JPEG, WEBP. TIFF and HEIC are stored and viewable (via "Open")
  but typed by hand.
- **The prompt** is the heart of the accuracy on messy packets: one patient, current order, conflicts
  noted, no guessing, exact codes, first-to-last-page sections, and `where` for every value. Copy it as is,
  then change only the business words (document types, payer types) to fit the other app.

**The demo reader.** `server/lib/demoPaperwork.ts` builds small fake PDFs and remembers what is on them
(keyed by the file's SHA-256), so the whole flow can be tried and tested with no API key and no real data.
Its `where` boxes are exact. Worth copying: it makes the automated tests possible.

### 2.6 Page tools (count pages, cut a packet into parts)

```ts
{{FILE:server/lib/pdfPages.ts}}
```

### 2.7 File storage and serving

Files are encrypted before they touch disk (AES-256-GCM, a random IV per file, the client's own key):

```ts
{{FILE:server/lib/fileStore.ts}}
```

Uploads (`multer` in memory, file-type allow-list) and `storeFiles()`, which records `pageCount`:

```ts
{{SNIPPET:server/routes/documents.ts|export const upload = multer|/** Which documents this patient needs}}
```

Serving a file to the viewer. **Gotcha:** if the app sends `X-Frame-Options: DENY` globally, override it on
this one route, or the viewer stays blank:

```ts
{{SNIPPET:server/routes/documents.ts|documentsRouter.get("/api/documents/:docId/file"|const docUpdate}}
```

### 2.8 Finding an existing patient

Scores candidates 0-100 (DOB 45, last name 30 or close spelling 18, first name 15, SSN last 4 25,
phone 10, claim # 35, member ID last 4 10). 80+ = "strong match", and the server refuses to create a new
patient until the reviewer confirms it's a different person.

```ts
{{FILE:server/lib/match.ts}}
```

### 2.9 The API routes

| Route | What it does |
|---|---|
| `GET /api/intake` | Inbox list (open or `?status=done`), with the name the reader found |
| `GET /api/intake/count` | Open count for the menu badge |
| `POST /api/intake` | Upload files (multipart `files`, plus `source`, `sender`) → creates the item, starts reading |
| `POST /api/intake/demo` | Local demo only: drop a fake fax/email into the Inbox |
| `GET /api/intake/:id` | Item + extraction + documents + possible matches (audited as a view) |
| `POST /api/intake/:id/matches` | Re-check matches with the corrected name/DOB/etc. |
| `POST /api/intake/:id/reread` | Run the reader again |
| `POST /api/intake/:id/complete` | File it (see below) |
| `POST /api/intake/:id/reject` | "Not patient paperwork", with a reason (nothing is deleted) |

`complete` takes: `decision` (new / existing), `patientId`, `patient` (all details for a new patient, or
only what should change for an existing one), `applyUpdates`, `replaceRanks` (which insurance slots to
overwrite), `confirmNotDuplicate`, `documents[]` (each with `sections[]`: fromPage, toPage, docType,
verified, skip), `note`, and `fieldReview[]` (field, label, aiValue, finalValue, confidence, outcome).
The server re-checks every page range against the real page count before saving anything.

Full source:

```ts
{{FILE:server/routes/intake.ts}}
```

`createPatientRecord`, `updatePatientRecord`, `patientView`, `loadPatientOr404`, `audit`, `publish`
(live updates to open screens), `requirePermission` and `req.tenant` are this app's own helpers. In the
other app, call its own equivalents.

### 2.10 The screens

**a) `PageViewer`: the document on the left, with jump-to-spot.** pdf.js draws each page on a canvas,
only when it's near the screen (packets can be 25+ pages). `focus = { page, box, label, n }` scrolls to the
page and draws a pulsing highlight. `n` changes on every click so the same field can be jumped to twice.

```tsx
{{FILE:client/src/components/PageViewer.tsx}}
```

Gotchas:
- The worker must be imported with Vite's `?url`: `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"`.
- React StrictMode runs effects twice in development. The `alive` flag stops the cancelled first load
  ("Worker was destroyed") from overwriting the good one. Without it the viewer says it can't show the PDF.
- `withCredentials: true` so the session cookie goes with the file request.

**b) `AiField`: the field that shows where its value came from.** Its origin is worked out on the fly by
comparing the current value with what the AI read (ignoring case and spaces), plus a "checked" flag:
`ai` (purple), `checked` (green), `edited` (amber, shows "AI read: …" and undo), `typed` (gray tag),
`empty`. A custom control (e.g. the payer drop-down) can be passed as `children`.

```tsx
{{FILE:client/src/components/AiField.tsx}}
```

**c) `PacketParts`: the page map and part cards.** `initialParts()` takes the reader's sections, drops
overlaps, and **joins neighboring pages of the same type** (unless one is marked a duplicate). This is
the safety net for when the AI lists a multi-page document page by page. `checkParts()` finds overlaps
and bad ranges before filing.

```tsx
{{FILE:client/src/components/PacketParts.tsx}}
```

**d) The review screen (`IntakeReview` in `Inbox.tsx`).** This is the screen that wires it all
together. The important parts:
- On load, fill the form from the extraction. Keep what the AI read for each field in a separate map
  (`aiP` for patient fields, `ins[n].ai` for insurance fields) so the origin can always be compared.
- `checked` is a map of field keys a person confirmed (`p.lastName`, `i0.claimNumber`).
- `locate(key, ai)` switches to the right file and sets `focus` from `ai.where`.
- `aiFields` lists every AI field on screen in screen order. It feeds the progress bar (`tally`),
  **Check next** (`goNext`) and the `fieldReview` sent when filing.
- Field ids are `f-<key>` (e.g. `f-p.lastName`), so "Check next" can find and focus them.

```tsx
{{FILE:client/src/screens/Inbox.tsx}}
```

App-specific pieces you'll replace: `useNav` (tabs/navigation), `useSession`, `get/post/uploadFiles`
(fetch wrappers), `Page`, `Badge`, `Modal`, `Select`, `ErrorBox`, `PAYER_TYPES`, `isoToDisplay`, and the
Tailwind color names `navy-*` / `accent-*` (the app's own theme colors).

### 2.11 Tests to copy

Every one of these runs with the AI switched off (`CALIBER_AI_READER=off` in the Vitest env), using the
demo reader and generated fake PDFs:

```ts
{{FILE:tests/intake-packets.test.ts}}
```

```ts
{{FILE:tests/intake-documents.test.ts}}
```

```ts
{{FILE:tests/reader.test.ts}}
```

Also keep a **cross-company test**: log in as company A and try to open, file or download company B's
Inbox item and files. It must fail with 404. (In Caliber: "can't file another client's packet" above.)

### 2.12 Problems we hit (so you don't)

| Symptom | Cause | Fix |
|---|---|---|
| Blank document preview | Global `X-Frame-Options: DENY` and a CSP `sandbox` on the file route | Per-route `SAMEORIGIN` and a PDF-specific CSP (2.7) |
| "This PDF couldn't be shown" in development only | StrictMode double effect destroys the first pdf.js task | `alive` flag in `PageViewer` |
| A 4-page form shown as 4 parts | The model sometimes lists pages one by one | The prompt says "first page to last page", and `initialParts()` joins neighbors |
| Highlight box a line off | `where.box` is the model's estimate | Pad the box (`pad = 0.012`) and always show the page. Acceptable by design |
| Reader crashes the item | Network/API error | Catch it, set status "review" with a plain message, and let the person type by hand |

### 2.13 Build order

1. Add the libraries (2.1) and the API key to the other app's secret storage (never in git).
2. Add the tables / columns (2.3) through that app's migrations.
3. Copy `shared/documents.ts`. Adjust `DOC_TYPES` and the payer type list to that business.
4. Copy `fileStore`, `pdfPages`, `reader`, `demoPaperwork`, `match`. Point them at that app's database
   and key handling.
5. Add the routes (2.9). Use that app's own auth, permissions, audit and patient/order create functions.
6. Add `PageViewer`, `AiField`, `PacketParts`, then the review screen.
7. Copy the tests. Add the cross-company test. Run type checks, the build and the tests.
8. Try it with the AI on, **with fake packets only**, until the BAA is signed.

### 2.14 A ready-made request for Claude in the other codebase

Paste this, together with this guide, into a Claude Code session in the other app's repository:

> Read `AI_INTAKE_BUILD_GUIDE.md` fully. Rebuild this AI paperwork intake feature in this codebase so it
> looks and behaves exactly the same: Inbox, background AI reader with the same prompt and output schema
> (with the `where` locations and first-to-last-page sections), the review screen with purple / green /
> amber AI fields, click-to-jump document viewer, Check next progress bar, packet page map and part cards,
> patient matching, filing with per-part PDFs, the accuracy note, and the `field_review` record. Use this
> app's own auth, permissions, audit log, database migrations and patient/order model; rename the
> `CALIBER_` settings to this app's names. Keep the AI switched off for real patient data until we confirm
> a signed BAA with Anthropic. Use only fake data in tests. First show me a plan that lists which of this
> app's existing parts you'll reuse and anything that doesn't map cleanly, then build it in small steps,
> running the type checks and tests as you go.
