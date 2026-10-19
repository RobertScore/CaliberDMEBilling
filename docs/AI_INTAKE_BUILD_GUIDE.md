# AI Paperwork Reader: How It Was Built (Rebuild Guide)

This guide explains the AI order intake built for Caliber DME Billing, step by step, so the same feature can
be rebuilt in another app. Part 1 is in plain words. Part 2 is the full technical recipe, with the real
source code, for the developer (or the Claude session) doing the rebuild.

> Generated from the Caliber code on 2026-10-19 (branch `claude/phase-1-foundation`, commit `a503b47`).
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
| `@anthropic-ai/sdk` | 0.135.0 | server | Calls Claude with structured (Zod) output |
| `pdf-lib` (MIT) | 1.17.1 | server | Counts pages and cuts a packet into one PDF per document |
| `pdfjs-dist` (Apache-2.0) | 5.4.296 | browser only | Draws PDF pages so the screen can jump to a page and highlight a box |
| `multer` | 2.4.0 | server | Receives uploads in memory (25 MB per file, 20 files) |
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
export const intakeItems = pgTable("intake_items", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sender: text("sender"),
  subject: text("subject"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("new"), // new, review, done, rejected
  reader: text("reader"), // claude, demo, manual
  extraction: jsonb("extraction"),
  readerError: text("reader_error"),
  suggestedPatientId: integer("suggested_patient_id"), // e.g. uploaded through that patient's own portal
  decision: text("decision"), // new | existing
  patientId: integer("patient_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  // Field by field: what the AI read, what was filed, and whether a person checked it (to measure AI accuracy).
  fieldReview: jsonb("field_review"),
  createdBy: text("created_by").notNull(),
});

// Every stored file. The bytes are encrypted with this client's key and kept in this client's own storage.
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  intakeId: integer("intake_id").references(() => intakeItems.id),
  docType: text("doc_type").notNull().default("other"),
  title: text("title"),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  source: text("source").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: text("uploaded_by").notNull(),
  // A person confirmed the type is right and the document is complete and readable.
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: text("verified_by"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by"),
  // Packets: how many pages a PDF has, and for a part split out of a packet, which file and pages it came from.
  pageCount: integer("page_count"),
  parentDocumentId: integer("parent_document_id"),
  pageFrom: integer("page_from"),
  pageTo: integer("page_to"),
});

// Follow-ups and the Call List. Created from notes with a follow-up date, or directly.
```

Migrations (Drizzle-generated SQL):

```sql
ALTER TABLE "documents" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "parent_document_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "page_from" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "page_to" integer;
ALTER TABLE "intake_items" ADD COLUMN "field_review" jsonb;
```

The `intake.process` permission guards every intake route (given to Biller and above).

### 2.4 The shared contract: what the reader returns

This file is used by both the server (to validate Claude's answer) and the screens. The Zod schema
**is** the output format Claude is forced to follow: the SDK turns it into a JSON schema, and the API
guarantees the answer fits it.

```ts
// Document types and what the intake reader returns. Shared by the screens and the server.
import { z } from "zod";

export const DOC_TYPES = [
  { code: "rx", label: "Prescription / order" },
  { code: "delivery_ticket", label: "Delivery ticket / proof of delivery" },
  { code: "po", label: "Purchase order (PO)" },
  { code: "rfa", label: "Request for Authorization (RFA)" },
  { code: "rfs", label: "Request for Service (RFS)" },
  { code: "authorization", label: "Authorization / approval" },
  { code: "chart_notes", label: "Chart notes / medical records" },
  { code: "demographics", label: "Demographics / face sheet" },
  { code: "insurance_card", label: "Insurance card" },
  { code: "referral", label: "VA referral" },
  { code: "eob", label: "EOB / remittance" },
  { code: "other", label: "Other" },
  { code: "packet", label: "Full packet (as received)" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["code"];
export const docTypeLabel = (c: string) => DOC_TYPES.find((d) => d.code === c)?.label ?? c;

export const INTAKE_SOURCES = ["upload", "fax", "email", "client_portal", "patient_portal", "api"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/heic", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// ---- What the reader (AI, demo, or a person) produces ----------------------------------
// Every value carries a confidence so the review screen can highlight what needs a closer look.
const conf = z.enum(["high", "medium", "low"]);
// Where on the paper a value was read: which file (0-based, in upload order), which page (1-based) and,
// when the reader can tell, a box around the writing as fractions of the page (0 = left/top, 1 = right/bottom).
// The box is approximate; it's for jumping the viewer to the right spot, not a measurement.
const where = z.object({
  file: z.number().int(),
  page: z.number().int(),
  box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
});
const field = z.object({ value: z.string().nullable(), confidence: conf, where: where.nullable() });
export type FieldWhere = z.infer<typeof where>;

export const extractedInsurance = z.object({
  rank: z.number().int().min(1).max(3),
  payerName: field,
  payerTypeGuess: z.enum(["WC", "VA_DIRECT", "VA_CCN", "MEDICARE", "MEDICAID", "COMMERCIAL", "SELF_PAY", "UNKNOWN"]),
  memberId: field,
  groupNumber: field,
  claimNumber: field,
  dateOfInjury: field,
  employerName: field,
  adjusterName: field,
  adjusterPhone: field,
  referralNumber: field,
  authorizationNumber: field,
});

export const extraction = z.object({
  patient: z.object({
    lastName: field,
    firstName: field,
    middleInitial: field,
    dob: field, // YYYY-MM-DD
    sex: field, // F / M / U
    ssn: field,
    address1: field,
    address2: field,
    city: field,
    state: field,
    zip: field,
    phone: field,
    cellPhone: field,
    email: field,
    employer: field,
  }),
  insurances: z.array(extractedInsurance),
  orderingPhysician: field,
  diagnosisCodes: z.array(z.string()),
  hcpcsCodes: z.array(z.string()),
  documents: z.array(z.object({ index: z.number().int(), docType: z.string(), confidence: conf, summary: z.string() })),
  // How each file splits into separate documents, by page (1-based, inclusive).
  // belongsTo: "this_patient", "other_patient" (misfiled page about someone else) or "none" (cover sheet, blank, junk).
  sections: z.array(
    z.object({
      fileIndex: z.number().int(),
      fromPage: z.number().int(),
      toPage: z.number().int(),
      docType: z.string(),
      belongsTo: z.enum(["this_patient", "other_patient", "none"]),
      confidence: conf,
      summary: z.string(),
    }),
  ),
  readerNotes: z.string(), // anything the reader couldn't make out, in plain words
});
export type Extraction = z.infer<typeof extraction>;
export type ExtractedField = z.infer<typeof field>;

/** One part of a packet, as the reviewer confirmed it when filing. */
export const sectionInput = z
  .object({
    fromPage: z.number().int().min(1),
    toPage: z.number().int().min(1),
    docType: z.enum(DOC_TYPES.map((d) => d.code) as [string, ...string[]]),
    verified: z.boolean(),
    skip: z.boolean().default(false), // not for this patient (cover sheet, junk, someone else's page)
  })
  .strict()
  .refine((s) => s.toPage >= s.fromPage, "A section's last page can't come before its first page");
export type SectionInput = z.infer<typeof sectionInput>;

export const emptyField = (): ExtractedField => ({ value: null, confidence: "low", where: null });
```

Key design choices:
- Every field is `{ value, confidence, where }`. `value: null` means "not on the paper". The prompt
  forbids guessing.
- `where.box` uses **fractions of the page** (0-1, top-left origin), so it works at any zoom level.
  It's an estimate: good enough to jump to the right spot, not a measurement.
- `sections` describes the whole packet page by page, with `belongsTo` to catch junk and misfiled pages.

### 2.5 The reader (Claude call, prompt, on/off switch, fallbacks)

```ts
// The paperwork reader: turns faxed / emailed / scanned documents into suggested field values.
//
// Modes, picked automatically:
//  - "claude": Claude reads typed text and handwriting. See aiReaderStatus() for when it's on.
//  - "demo": recognizes only the fake sample paperwork from demoPaperwork.ts (used when Claude is off).
//  - "manual": nothing is sent anywhere; staff type the fields while looking at the document.
//
// Whatever the mode, nothing is saved until a person reviews every field.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { extraction, DOC_TYPES, type Extraction } from "@shared/documents";
import { demoExtraction } from "./demoPaperwork";

export type ReaderFile = { data: Buffer; mimeType: string; sha256: string; name: string };
export type ReaderResult = { reader: "claude" | "demo" | "manual"; extraction: Extraction | null; error?: string };

/**
 * Is the Claude reader on?
 *  - CALIBER_AI_READER=off pauses it anywhere (the switch to flip before real patient data, until the BAA is signed).
 *  - Local demo (fake data only): on whenever ANTHROPIC_API_KEY is set. Robert's decision, 2026-10-17.
 *  - Production (real PHI): also needs CALIBER_AI_BAA_CONFIRMED=yes, i.e. a signed BAA with Anthropic (CLAUDE.md 3.2).
 */
export function aiReaderStatus(): { on: boolean; why: string } {
  const production = process.env.NODE_ENV === "production";
  if (process.env.CALIBER_AI_READER === "off") return { on: false, why: "The AI reader is paused." };
  if (!process.env.ANTHROPIC_API_KEY) return { on: false, why: "The AI reader needs an Anthropic API key (see docs/RUNNING_LOCALLY.md)." };
  if (production && process.env.CALIBER_AI_BAA_CONFIRMED !== "yes") return { on: false, why: "The AI reader stays off for real patient data until Caliber's BAA with Anthropic is signed." };
  return { on: true, why: production ? "AI reader on (BAA signed)." : "AI reader on. Demo: upload fake paperwork only." };
}
export const aiReaderEnabled = () => aiReaderStatus().on;

const SYSTEM = `You read paperwork for a durable medical equipment (DME) billing office: faxed referrals, prescriptions,
delivery tickets, purchase orders, Workers' Compensation RFA forms, VA referrals, insurance cards and chart notes.
Pages may be typed, handwritten, skewed or low quality.

Packets are often long and messy: old claims, relatives, attorneys, nurse case managers, other insurance cards,
prior authorizations, cancelled items, duplicate or upside-down pages, and sometimes a page about a different person.
- Extract the details of the ONE patient the packet is about, for the CURRENT order. Ignore other people's details.
- When there are several claims, referrals or authorizations, use the one that matches the current order and is
  active / most recent; mention the others in readerNotes.
- When pages disagree (a different date of birth, claim number or date of injury), pick the value most pages support,
  mark it "low" confidence, and describe the conflict in readerNotes.
- In readerNotes, also list any page that seems to belong to a different patient, and any item that was denied or cancelled.

Extract only what is actually written. Never guess or fill in a value that isn't on the page.
- If a value is missing, return null.
- Confidence: "high" when clearly legible; "medium" when you had to interpret handwriting or a smudge; "low" when
  you're unsure between readings. Explain anything unclear in readerNotes in plain words.
- Dates as YYYY-MM-DD. Sex as F, M or U. Names in capital letters. Phone numbers as written.
- ICD-10 diagnosis codes and HCPCS codes exactly as written (e.g. M25.561, E0218).
- payerTypeGuess: WC for workers' comp carriers/TPAs; VA_DIRECT for the VA itself; VA_CCN for VA community care
  administrators; otherwise MEDICARE, MEDICAID, COMMERCIAL, SELF_PAY or UNKNOWN.
- For each file (in the order given, index from 0) give the best document type from: ${DOC_TYPES.map((d) => d.code).join(", ")}.
- where: for every value you fill in, say where you read it: file (0-based, in the order given), page (1-based
  within that file) and box = the area around the writing as fractions of the page: x and y of the top-left
  corner, then width w and height h, each from 0 to 1 (0,0 = top-left of the page). Give your best estimate of
  the box; use null for box only if you can't tell. If the value is on several pages, point to the clearest one.
  Use where = null only when the value is null.
- sections: split every file into its separate documents. A document runs from its FIRST page to its LAST page:
  a 3-page RFA, a 6-page set of chart notes or a 4-page MRI report is ONE section (e.g. pages 4-6), not one
  section per page. Start a new section only where a different document begins (a new form, letterhead, title,
  date of service or patient). Pages are numbered from 1 within each file; ranges are inclusive, don't overlap,
  and every page is in exactly one section. Use the same document types (never "packet").
  belongsTo: "this_patient" for the patient's own documents, "other_patient" for pages about someone else,
  "none" for fax cover sheets, blank pages, ads and surveys. A duplicate copy of a document is its own section
  with a summary saying it's a duplicate. An upside-down page still belongs to its document.`;

let client: Anthropic | null = null;

async function readWithClaude(files: ReaderFile[]): Promise<Extraction> {
  client ??= new Anthropic();
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  files.forEach((f, i) => {
    content.push({ type: "text", text: `File ${i}: ${f.name}` });
    if (f.mimeType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") } });
    } else {
      const mt = f.mimeType as "image/png" | "image/jpeg" | "image/webp";
      content.push({ type: "image", source: { type: "base64", media_type: mt, data: f.data.toString("base64") } });
    }
  });
  content.push({ type: "text", text: "Read these files and return the fields." });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "high", format: betaZodOutputFormat(extraction) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The reader declined this document. Please enter the fields by hand.");
  if (!response.parsed_output) throw new Error("The reader couldn't produce the fields. Please enter them by hand.");
  return response.parsed_output;
}

export async function readPaperwork(files: ReaderFile[]): Promise<ReaderResult> {
  // When Claude is on it reads everything, including the samples, so you see the real thing.
  // When it's off (or fails) the fake samples still fill in from the demo reader.
  const demo = demoExtraction(files.map((f) => f.sha256));
  const fallback = (error?: string): ReaderResult => (demo ? { reader: "demo", extraction: demo, error } : { reader: "manual", extraction: null, error });
  if (!aiReaderEnabled()) return fallback();
  const supported = files.filter((f) => ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(f.mimeType));
  if (!supported.length) return fallback("These file types (TIFF, HEIC) can't be read automatically. Please enter the fields by hand.");
  try {
    return { reader: "claude", extraction: await readWithClaude(supported) };
  } catch (err) {
    // Typed SDK errors carry a status; never log document content.
    const msg =
      err instanceof Anthropic.RateLimitError
        ? "The reader is busy. Try again in a minute, or enter the fields by hand."
        : err instanceof Anthropic.APIError
          ? `The reader is unavailable (${err.status}). Please enter the fields by hand.`
          : err instanceof Error
            ? err.message
            : "The reader failed. Please enter the fields by hand.";
    return fallback(msg);
  }
}
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
// Page tools for packets: count a PDF's pages and copy a page range into a new PDF.
// Runs entirely on our server (pdf-lib); nothing is sent anywhere.
import { PDFDocument } from "pdf-lib";

/** Number of pages, or null if the file isn't a readable PDF (e.g. password-protected). */
export async function pdfPageCount(data: Buffer): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(data, { ignoreEncryption: false, updateMetadata: false });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}

/** A new PDF holding pages fromPage..toPage (1-based, inclusive) of the original. */
export async function extractPages(data: Buffer, fromPage: number, toPage: number): Promise<Buffer> {
  const src = await PDFDocument.load(data, { updateMetadata: false });
  const count = src.getPageCount();
  if (fromPage < 1 || toPage > count || toPage < fromPage) throw new RangeError(`Pages ${fromPage}-${toPage} are outside this ${count}-page file`);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}
```

### 2.7 File storage and serving

Files are encrypted before they touch disk (AES-256-GCM, a random IV per file, the client's own key):

```ts
// Encrypted file storage, one area per client. (CLAUDE.md 3.1: each client gets its own storage and key.)
// Local demo: files live in data/clients/<slug>/files/. Production: the client's own bucket under the BAA.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Tenant } from "../db/tenantDb";
import { DATA_DIR, IN_MEMORY } from "../config";

const memory = new Map<string, Buffer>(); // tests only, keyed by "<slug>/<key>"

function encrypt(key: Buffer, data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([Buffer.from("CDB1"), iv, c.getAuthTag(), enc]);
}

function decrypt(key: Buffer, blob: Buffer): Buffer {
  if (blob.subarray(0, 4).toString() !== "CDB1") throw new Error("Unrecognized file format");
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

function fileDir(tenant: Tenant) {
  const dir = path.join(DATA_DIR, "clients", tenant.slug, "files");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Store bytes for this client only. Returns the storage key. */
export function putFile(tenant: Tenant, data: Buffer): string {
  const key = crypto.randomUUID();
  const blob = encrypt(tenant.key, data);
  if (IN_MEMORY) memory.set(`${tenant.slug}/${key}`, blob);
  else fs.writeFileSync(path.join(fileDir(tenant), `${key}.enc`), blob, { mode: 0o600 });
  return key;
}

export function getFile(tenant: Tenant, storageKey: string): Buffer {
  if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new Error("Bad storage key");
  const blob = IN_MEMORY ? memory.get(`${tenant.slug}/${storageKey}`) : fs.readFileSync(path.join(fileDir(tenant), `${storageKey}.enc`));
  if (!blob) throw new Error("File not found");
  return decrypt(tenant.key, blob);
}

export const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
```

Uploads (`multer` in memory, file-type allow-list) and `storeFiles()`, which records `pageCount`:

```ts
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 },
  fileFilter: (_req, file, cb) => cb(null, (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)),
});

export const documentsRouter = Router();
documentsRouter.use(["/api/patients/:id/documents", "/api/documents"], requireAuth, requireClient);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

/** Save uploaded files into this client's encrypted storage. */
export async function storeFiles(
  req: Request,
  files: Express.Multer.File[],
  meta: { patientId?: number | null; intakeId?: number | null; source: string; docType?: string; uploadedBy?: string },
) {
  const t = req.tenant!;
  const rows = [];
  for (const f of files) {
    const storageKey = putFile(t, f.buffer);
    const [d] = await t.db
      .insert(documents)
      .values({
        patientId: meta.patientId ?? null,
        intakeId: meta.intakeId ?? null,
        docType: meta.docType ?? "other",
        originalName: f.originalname.slice(0, 200),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        sha256: sha256(f.buffer),
        storageKey,
        source: meta.source,
        uploadedBy: meta.uploadedBy ?? req.user!.initials,
        pageCount: f.mimetype === "application/pdf" ? await pdfPageCount(f.buffer) : 1,
      })
      .returning();
    rows.push(d);
  }
  return rows;
}
```

Serving a file to the viewer. **Gotcha:** if the app sends `X-Frame-Options: DENY` globally, override it on
this one route, or the viewer stays blank:

```ts
documentsRouter.get("/api/documents/:docId/file", requirePermission("document.view"), async (req, res) => {
  const d = await loadDoc(req);
  const data = getFile(req.tenant!, d.storageKey);
  await audit(req, { action: "view", entityType: "document", entityId: d.id, patientId: d.patientId ?? undefined });
  res.setHeader("Content-Type", d.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="document-${d.id}"`);
  // Only our own pages may show it in a frame. "sandbox" stops Chrome's built-in PDF viewer, so PDFs get
  // a no-scripts policy instead; images and other types stay fully sandboxed.
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Content-Security-Policy", d.mimeType === "application/pdf" ? "default-src 'none'; object-src 'self'; frame-ancestors 'self'" : "sandbox; frame-ancestors 'self'");
  res.send(data);
});
```

### 2.8 Finding an existing patient

Scores candidates 0-100 (DOB 45, last name 30 or close spelling 18, first name 15, SSN last 4 25,
phone 10, claim # 35, member ID last 4 10). 80+ = "strong match", and the server refuses to create a new
patient until the reviewer confirms it's a different person.

```ts
// Is this paperwork for a patient we already have? Scores possible matches inside ONE client only.
import { isNull } from "drizzle-orm";
import { patients, patientInsurances } from "@shared/schema/tenant";
import type { Tenant } from "../db/tenantDb";

export type MatchInput = { lastName?: string | null; firstName?: string | null; dob?: string | null; ssnLast4?: string | null; phone?: string | null; claimNumber?: string | null; memberIdLast4?: string | null };
export type MatchCandidate = { patientId: number; accountNumber: string; lastName: string; firstName: string; dob: string; score: number; reasons: string[] };

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Score 0-100. 80+ means "very likely the same person": staff must decide before filing. */
export async function findMatches(tenant: Tenant, input: MatchInput): Promise<MatchCandidate[]> {
  const rows = await tenant.db.select().from(patients).where(isNull(patients.removedAt));
  const ins = await tenant.db.select().from(patientInsurances);
  const L = norm(input.lastName), F = norm(input.firstName);
  const out: MatchCandidate[] = [];
  for (const p of rows) {
    const reasons: string[] = [];
    let score = 0;
    const pl = norm(p.lastName), pf = norm(p.firstName);
    const sameDob = !!input.dob && input.dob === p.dob;
    const lastExact = !!L && L === pl;
    const lastClose = !!L && !lastExact && L.length > 2 && editDistance(L, pl) <= 2;
    const firstMatch = !!F && (F === pf || pf.startsWith(F) || F.startsWith(pf));
    if (sameDob) { score += 45; reasons.push("Same date of birth"); }
    if (lastExact) { score += 30; reasons.push("Same last name"); } else if (lastClose) { score += 18; reasons.push("Similar last name"); }
    if (firstMatch) { score += 15; reasons.push("Same first name"); }
    if (input.ssnLast4 && p.ssnLast4 && input.ssnLast4 === p.ssnLast4) { score += 25; reasons.push("SSN last 4 match"); }
    if (digits(input.phone).length >= 7 && [p.phone, p.cellPhone].some((x) => digits(x) && digits(x).endsWith(digits(input.phone).slice(-7)))) { score += 10; reasons.push("Same phone"); }
    const theirIns = ins.filter((i) => i.patientId === p.id);
    if (input.claimNumber && theirIns.some((i) => norm(i.claimNumber) === norm(input.claimNumber))) { score += 35; reasons.push("Same claim number"); }
    if (input.memberIdLast4 && theirIns.some((i) => i.memberIdLast4 === input.memberIdLast4)) { score += 10; reasons.push("Member ID last 4 match"); }
    if (score >= 40) out.push({ patientId: p.id, accountNumber: p.accountNumber, lastName: p.lastName, firstName: p.firstName, dob: p.dob, score: Math.min(score, 100), reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
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
// The intake inbox: paperwork in → read → review → match → file to a new or existing patient.
import { Router, type Request } from "express";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { documents, intakeItems, notes, patients } from "@shared/schema/tenant";
import { DOC_TYPES, INTAKE_SOURCES, docTypeLabel, sectionInput, type Extraction, type SectionInput } from "@shared/documents";
import { insuranceInput, patientInput, type PatientInput } from "@shared/validation";
import { getFile, putFile, sha256 } from "../lib/fileStore";
import { extractPages, pdfPageCount } from "../lib/pdfPages";
import { readPaperwork } from "../lib/reader";
import { findMatches, type MatchInput } from "../lib/match";
import { demoPacket } from "../lib/demoPaperwork";
import { publish } from "../lib/events";
import { last4 } from "../lib/crypto";
import { IS_PRODUCTION } from "../config";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { storeFiles, upload } from "./documents";
import { createPatientRecord, loadPatientOr404, patientView, updatePatientRecord } from "./patients";
import type { Tenant } from "../db/tenantDb";

export const intakeRouter = Router();
intakeRouter.use("/api/intake", requireAuth, requireClient);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

/** Create an inbox item from files. Used by staff uploads, both portals and the inbound API. */
export async function createIntake(
  req: Request,
  files: Express.Multer.File[],
  meta: { source: string; sender?: string | null; subject?: string | null; suggestedPatientId?: number | null; createdBy: string },
) {
  const t = req.tenant!;
  const [item] = await t.db
    .insert(intakeItems)
    .values({ source: meta.source, sender: meta.sender ?? null, subject: meta.subject ?? null, suggestedPatientId: meta.suggestedPatientId ?? null, status: "reading", createdBy: meta.createdBy })
    .returning();
  await storeFiles(req, files, { intakeId: item.id, source: meta.source, uploadedBy: meta.createdBy });
  publish(t.clientId, { kind: "intake" });
  // Reading can take a little while with the AI reader; it runs in the background and the inbox updates live.
  void runReader(t, item.id);
  return item;
}

export async function runReader(t: Tenant, intakeId: number) {
  try {
    const docs = await t.db.select().from(documents).where(eq(documents.intakeId, intakeId));
    const files = docs.map((d) => ({ data: getFile(t, d.storageKey), mimeType: d.mimeType, sha256: d.sha256, name: d.originalName }));
    const result = await readPaperwork(files);
    // Apply the reader's suggested document types (still unverified until a person checks).
    for (const g of result.extraction?.documents ?? []) {
      const d = docs[g.index];
      if (d && DOC_TYPES.some((x) => x.code === g.docType)) await t.db.update(documents).set({ docType: g.docType }).where(eq(documents.id, d.id));
    }
    await t.db.update(intakeItems).set({ status: "review", reader: result.reader, extraction: result.extraction, readerError: result.error ?? null }).where(eq(intakeItems.id, intakeId));
  } catch {
    await t.db.update(intakeItems).set({ status: "review", reader: "manual", readerError: "The reader failed. Please enter the fields by hand." }).where(eq(intakeItems.id, intakeId));
  }
  publish(t.clientId, { kind: "intake" });
}

function matchInputFrom(e: Extraction | null): MatchInput {
  if (!e) return {};
  const p = e.patient;
  return {
    lastName: p.lastName.value,
    firstName: p.firstName.value,
    dob: p.dob.value,
    ssnLast4: p.ssn.value ? last4(p.ssn.value) : null,
    phone: p.phone.value ?? p.cellPhone.value,
    claimNumber: e.insurances.find((i) => i.claimNumber.value)?.claimNumber.value ?? null,
    memberIdLast4: e.insurances.find((i) => i.memberId.value)?.memberId.value ? last4(e.insurances.find((i) => i.memberId.value)!.memberId.value!) : null,
  };
}

const publicDoc = (d: typeof documents.$inferSelect) => {
  const { storageKey: _k, ...rest } = d;
  return { ...rest, typeLabel: docTypeLabel(d.docType) };
};

intakeRouter.get("/api/intake", requirePermission("intake.process"), async (req, res) => {
  const done = req.query.status === "done";
  const rows = await req.tenant!.db
    .select({
      id: intakeItems.id, source: intakeItems.source, sender: intakeItems.sender, subject: intakeItems.subject, receivedAt: intakeItems.receivedAt,
      status: intakeItems.status, reader: intakeItems.reader, decision: intakeItems.decision, patientId: intakeItems.patientId, completedAt: intakeItems.completedAt, completedBy: intakeItems.completedBy,
      docCount: sql<number>`(select count(*)::int from documents d where d.intake_id = "intake_items"."id")`,
      patientName: sql<string | null>`(select p.last_name || ', ' || p.first_name from patients p where p.id = coalesce("intake_items"."patient_id", "intake_items"."suggested_patient_id"))`,
      extraction: intakeItems.extraction,
    })
    .from(intakeItems)
    .where(done ? inArray(intakeItems.status, ["done", "rejected"]) : inArray(intakeItems.status, ["reading", "review", "new"]))
    .orderBy(desc(intakeItems.receivedAt))
    .limit(200);
  // Show the name the reader found, so the inbox is easy to scan.
  res.json(rows.map(({ extraction, ...r }) => {
    const e = extraction as Extraction | null;
    const found = e ? [e.patient.lastName.value, e.patient.firstName.value].filter(Boolean).join(", ") : null;
    return { ...r, foundName: r.patientName ?? (found || null) };
  }));
});

intakeRouter.get("/api/intake/count", requirePermission("intake.process"), async (req, res) => {
  const [{ n }] = await req.tenant!.db.select({ n: sql<number>`count(*)::int` }).from(intakeItems).where(inArray(intakeItems.status, ["reading", "review", "new"]));
  res.json({ open: n });
});

/** Staff upload (or scan) of new paperwork. */
intakeRouter.post("/api/intake", requirePermission("intake.process"), upload.array("files", 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "Choose a PDF or image to upload (PDF, PNG, JPG, TIFF, HEIC, WEBP up to 25 MB).");
  const source = (INTAKE_SOURCES as readonly string[]).includes(req.body.source) ? req.body.source : "upload";
  const item = await createIntake(req, files, { source, sender: String(req.body.sender ?? "").slice(0, 120) || null, subject: String(req.body.subject ?? "").slice(0, 200) || null, createdBy: req.user!.initials });
  await audit(req, { action: "create", entityType: "intake", entityId: item.id, details: `${files.length} files via ${source}` });
  res.status(201).json(item);
});

/** Local demo only: pretend a fax or email just arrived, using fake sample paperwork. */
intakeRouter.post("/api/intake/demo", requirePermission("intake.process"), async (req, res) => {
  if (IS_PRODUCTION) throw new HttpError(404, "Not found");
  const kind = req.body?.kind === "existing" ? "existing" : "new";
  const [first] = await req.tenant!.db.select().from(patients).where(sql`${patients.lastName} like 'TEST-%'`).limit(1);
  const packet = demoPacket(kind, first?.lastName ?? "TEST-SCORE");
  const file = { buffer: packet.pdf, originalname: packet.name, mimetype: "application/pdf", size: packet.pdf.length } as Express.Multer.File;
  const item = await createIntake(req, [file], {
    source: kind === "new" ? "fax" : "email",
    sender: kind === "new" ? "Fax (555) 010-0100 · Sample Orthopedic Clinic" : "deliveries@sample-dme.test",
    subject: kind === "new" ? "New DME order" : "Signed delivery ticket",
    createdBy: "SYS",
  });
  res.status(201).json(item);
});

intakeRouter.get("/api/intake/:id", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const [item] = await req.tenant!.db.select().from(intakeItems).where(eq(intakeItems.id, id));
  if (!item) throw new HttpError(404, "Not found");
  const docs = await req.tenant!.db.select().from(documents).where(eq(documents.intakeId, id));
  // Files uploaded before page counts were recorded: count them now so they can be split.
  for (const d of docs) {
    if (d.mimeType === "application/pdf" && d.pageCount == null) {
      d.pageCount = await pdfPageCount(getFile(req.tenant!, d.storageKey));
      if (d.pageCount) await req.tenant!.db.update(documents).set({ pageCount: d.pageCount }).where(eq(documents.id, d.id));
    }
  }
  const matches = item.status === "review" ? await findMatches(req.tenant!, matchInputFrom(item.extraction as Extraction | null)) : [];
  if (item.suggestedPatientId && !matches.some((m) => m.patientId === item.suggestedPatientId)) {
    const [p] = await req.tenant!.db.select().from(patients).where(eq(patients.id, item.suggestedPatientId));
    if (p) matches.unshift({ patientId: p.id, accountNumber: p.accountNumber, lastName: p.lastName, firstName: p.firstName, dob: p.dob, score: 100, reasons: ["Uploaded through this patient's portal"] });
  }
  await audit(req, { action: "view", entityType: "intake", entityId: id });
  res.json({ ...item, documents: docs.map(publicDoc), matches });
});

/** Re-check for matches using the fields as the reviewer has corrected them. */
intakeRouter.post("/api/intake/:id/matches", requirePermission("intake.process"), async (req, res) => {
  idOf(req.params.id);
  const b = z.object({ lastName: z.string().optional(), firstName: z.string().optional(), dob: z.string().optional(), ssn: z.string().optional(), phone: z.string().optional(), claimNumber: z.string().optional() }).parse(req.body);
  res.json(await findMatches(req.tenant!, { ...b, ssnLast4: b.ssn ? last4(b.ssn) : null }));
});

intakeRouter.post("/api/intake/:id/reread", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  await req.tenant!.db.update(intakeItems).set({ status: "reading" }).where(and(eq(intakeItems.id, id), ne(intakeItems.status, "done")));
  publish(req.tenant!.clientId, { kind: "intake" });
  void runReader(req.tenant!, id);
  res.json({ ok: true });
});

const completeInput = z
  .object({
    decision: z.enum(["new", "existing"]),
    patientId: z.number().int().positive().optional(),
    // New patient: the full details. Existing patient: only what should change (see applyUpdates / insurances).
    patient: z.unknown().optional(),
    applyUpdates: z.boolean().default(false), // existing patient: also update name, address, phone...
    replaceRanks: z.array(z.number().int().min(1).max(3)).default([]), // existing patient: insurance slots to overwrite, not merge
    confirmNotDuplicate: z.boolean().default(false),
    documents: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            docType: z.enum(DOC_TYPES.map((d) => d.code) as [string, ...string[]]),
            verified: z.boolean(),
            sections: z.array(sectionInput).max(60).optional(),
          })
          .strict(),
      )
      .min(1),
    note: z.string().trim().max(2000).optional(),
    // How each AI-read field ended up (checked, corrected, left unchecked). Stored for accuracy tracking.
    fieldReview: z
      .array(
        z
          .object({
            field: z.string().max(60),
            label: z.string().max(120),
            aiValue: z.string().max(500).nullable(),
            finalValue: z.string().max(500).nullable(),
            confidence: z.enum(["high", "medium", "low"]),
            outcome: z.enum(["ai", "checked", "edited", "typed", "empty"]),
          })
          .strict(),
      )
      .max(200)
      .default([]),
  })
  .strict();

/** A one-line accuracy summary for the account note (counts only, no values). */
export function reviewLine(review: { outcome: string }[]): string {
  if (!review.length) return "";
  const n = (o: string) => review.filter((r) => r.outcome === o).length;
  const parts = [`${n("checked")} checked as right`, `${n("edited")} corrected`];
  if (n("ai")) parts.push(`${n("ai")} not checked`);
  return `AI read ${review.length} field${review.length === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

// What an existing patient's file may be updated with: any subset of the fields, plus insurances by slot.
const existingUpdate = patientInput.partial().extend({ insurances: z.array(insuranceInput).max(3).default([]) });
type ExistingUpdate = z.infer<typeof existingUpdate>;

/**
 * Merge reviewed values over what's on file. Only non-empty values replace. Insurance goes by slot (rank):
 * a slot listed in replaceRanks is overwritten completely (a different claim); otherwise the new values are
 * laid over the old ones (same claim, e.g. a new authorization number).
 */
async function mergeIntoExisting(req: Request, id: number, reviewed: ExistingUpdate, replaceRanks: number[]): Promise<PatientInput> {
  const cur = await patientView(req, id);
  const keys = Object.keys(patientInput.shape) as (keyof PatientInput)[];
  const base: Record<string, unknown> = {};
  for (const k of keys) if (k !== "insurances" && k !== "ssn" && (cur as Record<string, unknown>)[k] != null) base[k] = (cur as Record<string, unknown>)[k];
  for (const [k, v] of Object.entries(reviewed)) if (k !== "insurances" && v !== undefined && v !== null && v !== "") base[k] = v;
  const insKeys = ["rank", "payerId", "claimNumber", "copayCents", "deductibleCents", "eligibleFrom", "eligibleTo", "relationshipToInsured", "subscriberLastName", "subscriberFirstName", "subscriberDob", "subscriberSex", "groupNumber", "groupName", "dateOfInjury", "employerName", "adjusterName", "adjusterPhone", "referralNumber", "authorizationNumber"];
  const byRank = new Map<number, Record<string, unknown>>();
  for (const i of cur.insurances) byRank.set(i.rank, Object.fromEntries(insKeys.filter((k) => (i as Record<string, unknown>)[k] != null).map((k) => [k, (i as Record<string, unknown>)[k]])));
  for (const i of reviewed.insurances) {
    const fresh = Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined && v !== ""));
    byRank.set(i.rank, replaceRanks.includes(i.rank) ? fresh : { ...(byRank.get(i.rank) ?? {}), ...fresh });
  }
  return patientInput.parse({ ...base, insurances: [...byRank.values()] });
}

const PDF = "application/pdf";

/** Check a file's sections against its pages before anything is saved. */
function checkSections(d: typeof documents.$inferSelect, sections: SectionInput[]) {
  if (d.mimeType !== PDF || !d.pageCount) throw new HttpError(400, `"${d.originalName}" can't be split into parts. File it as one document.`);
  const sorted = [...sections].sort((a, b) => a.fromPage - b.fromPage);
  for (const [i, sct] of sorted.entries()) {
    if (sct.toPage > d.pageCount) throw new HttpError(400, `"${d.originalName}" has ${d.pageCount} pages; pages ${sct.fromPage}-${sct.toPage} don't exist`);
    if (i > 0 && sct.fromPage <= sorted[i - 1].toPage) throw new HttpError(400, `Parts of "${d.originalName}" overlap (pages ${sorted[i - 1].fromPage}-${sorted[i - 1].toPage} and ${sct.fromPage}-${sct.toPage})`);
  }
}

const isWholeFile = (d: typeof documents.$inferSelect, s: SectionInput[]) => s.length === 1 && !s[0].skip && s[0].fromPage === 1 && s[0].toPage === (d.pageCount ?? 1);
const pagesText = (a: number, b: number) => (a === b ? `page ${a}` : `pages ${a}-${b}`);

intakeRouter.post("/api/intake/:id/complete", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const t = req.tenant!;
  const [item] = await t.db.select().from(intakeItems).where(eq(intakeItems.id, id));
  if (!item || item.status === "done" || item.status === "rejected") throw new HttpError(409, "This paperwork was already handled");
  const input = completeInput.parse(req.body);
  const docs = await t.db.select().from(documents).where(eq(documents.intakeId, id));
  const docIds = new Set(docs.map((d) => d.id));
  if (input.documents.some((d) => !docIds.has(d.id))) throw new HttpError(400, "Those documents aren't part of this paperwork");
  for (const d of input.documents) if (d.sections?.length) checkSections(docs.find((x) => x.id === d.id)!, d.sections);

  let patientId: number;
  if (input.decision === "new") {
    if (!input.patient) throw new HttpError(400, "Fill in the patient's details to create a new patient");
    const patient = patientInput.parse(input.patient);
    // Don't create a duplicate by accident: a strong match must be explicitly dismissed.
    const strong = (await findMatches(t, { lastName: patient.lastName, firstName: patient.firstName, dob: patient.dob, ssnLast4: patient.ssn ? last4(patient.ssn) : null, phone: patient.phone, claimNumber: patient.insurances.find((i) => i.claimNumber)?.claimNumber })).filter((m) => m.score >= 80);
    if (strong.length && !input.confirmNotDuplicate) {
      throw new HttpError(409, `This looks like an existing patient (${strong[0].lastName}, ${strong[0].firstName}, #${strong[0].accountNumber}). Attach it to them, or confirm it's a different person.`);
    }
    patientId = (await createPatientRecord(req, patient)).id;
  } else {
    if (!input.patientId) throw new HttpError(400, "Pick the existing patient");
    await loadPatientOr404(req, input.patientId);
    patientId = input.patientId;
    if (input.patient) {
      const upd = existingUpdate.parse(input.patient);
      const changes: ExistingUpdate = input.applyUpdates ? upd : { insurances: upd.insurances };
      if (input.applyUpdates || changes.insurances.length) {
        await updatePatientRecord(req, patientId, await mergeIntoExisting(req, patientId, changes, input.replaceRanks), "updated from intake");
      }
    }
  }

  // File the documents. A packet split into parts becomes one document per part; the full packet stays with the
  // inbox item (not on the patient's file), so pages about someone else never land in this patient's documents.
  const filed: string[] = [];
  const setAside: string[] = [];
  for (const d of input.documents) {
    const orig = docs.find((x) => x.id === d.id)!;
    const verifiedBy = (v: boolean) => (v ? { verifiedAt: new Date(), verifiedBy: req.user!.initials } : {});
    if (!d.sections?.length || isWholeFile(orig, d.sections)) {
      const s0 = d.sections?.[0];
      const docType = s0?.docType ?? d.docType;
      await t.db.update(documents).set({ patientId, docType, ...verifiedBy(s0?.verified ?? d.verified) }).where(eq(documents.id, d.id));
      filed.push(docTypeLabel(docType));
      continue;
    }
    const data = getFile(t, orig.storageKey);
    const base = orig.originalName.replace(/\.pdf$/i, "");
    for (const sct of [...d.sections].sort((a, b) => a.fromPage - b.fromPage)) {
      if (sct.skip) {
        setAside.push(pagesText(sct.fromPage, sct.toPage));
        continue;
      }
      const part = await extractPages(data, sct.fromPage, sct.toPage);
      await t.db.insert(documents).values({
        patientId, intakeId: id, docType: sct.docType, title: `${docTypeLabel(sct.docType)} (${pagesText(sct.fromPage, sct.toPage)} of ${orig.originalName})`,
        originalName: `${base}-p${sct.fromPage}${sct.toPage > sct.fromPage ? `-${sct.toPage}` : ""}.pdf`.slice(0, 200), mimeType: PDF, sizeBytes: part.length, sha256: sha256(part),
        storageKey: putFile(t, part), source: orig.source, receivedAt: orig.receivedAt, uploadedBy: orig.uploadedBy, pageCount: sct.toPage - sct.fromPage + 1,
        parentDocumentId: orig.id, pageFrom: sct.fromPage, pageTo: sct.toPage, ...verifiedBy(sct.verified),
      });
      filed.push(`${docTypeLabel(sct.docType)} (${pagesText(sct.fromPage, sct.toPage)})`);
    }
    await t.db.update(documents).set({ docType: "packet" }).where(eq(documents.id, orig.id));
  }

  const summary = [
    `Paperwork received by ${item.source}${item.sender ? ` from ${item.sender}` : ""}. Filed to ${input.decision === "new" ? "a new patient" : "existing patient"}: ${filed.join(", ") || "nothing"}.`,
    setAside.length ? `Set aside, not for this patient (still in Inbox item #${id}): ${setAside.join(", ")}.` : "",
    reviewLine(input.fieldReview),
    input.note ?? "",
  ].filter(Boolean).join("\n");
  await t.db.insert(notes).values({ patientId, body: summary, category: "intake", createdBy: req.user!.initials });
  await t.db.update(intakeItems).set({ status: "done", decision: input.decision, patientId, completedAt: new Date(), completedBy: req.user!.initials, fieldReview: input.fieldReview.length ? input.fieldReview : null }).where(eq(intakeItems.id, id));
  await audit(req, { action: "post", entityType: "intake", entityId: id, patientId, details: `${input.decision}; ${filed.length} documents filed; ${setAside.length} parts set aside` });
  publish(t.clientId, { kind: "intake" });
  publish(t.clientId, { kind: "documents", patientId });
  publish(t.clientId, { kind: "notes", patientId });
  publish(t.clientId, { kind: "patient", patientId });
  res.json({ patientId, filed: filed.length, setAside: setAside.length });
});

intakeRouter.post("/api/intake/:id/reject", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).strict().parse(req.body);
  const r = await req.tenant!.db
    .update(intakeItems)
    .set({ status: "rejected", completedAt: new Date(), completedBy: req.user!.initials, readerError: `Not filed: ${reason}` })
    .where(and(eq(intakeItems.id, id), inArray(intakeItems.status, ["review", "reading", "new"])))
    .returning();
  if (!r.length) throw new HttpError(409, "This paperwork was already handled");
  await audit(req, { action: "remove", entityType: "intake", entityId: id, details: "not filed" });
  publish(req.tenant!.clientId, { kind: "intake" });
  res.json({ ok: true });
});
```

`createPatientRecord`, `updatePatientRecord`, `patientView`, `loadPatientOr404`, `audit`, `publish`
(live updates to open screens), `requirePermission` and `req.tenant` are this app's own helpers. In the
other app, call its own equivalents.

### 2.10 The screens

**a) `PageViewer`: the document on the left, with jump-to-spot.** pdf.js draws each page on a canvas,
only when it's near the screen (packets can be 25+ pages). `focus = { page, box, label, n }` scrolls to the
page and draws a pulsing highlight. `n` changes on every click so the same field can be jumped to twice.

```tsx
// A document viewer that can jump to a page and highlight a spot on it (used when checking what the AI read).
// PDFs are drawn with pdf.js (runs in the browser; nothing is sent anywhere). Images are shown as they are.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Box = { x: number; y: number; w: number; h: number };
/** Where to look: a page (1-based), optionally a box on it (fractions of the page). `n` changes on every jump. */
export type Focus = { page: number; box: Box | null; label?: string; n: number };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function Highlight({ box, label, n }: { box: Box | null; label?: string; n: number }) {
  if (!box) {
    return (
      <div key={n} className="pointer-events-none absolute inset-0 animate-[pulse_1s_ease-in-out_2] rounded-sm ring-4 ring-violet-500/70">
        {label && <span className="absolute left-2 top-2 rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{label}</span>}
      </div>
    );
  }
  // A little padding: the AI's box is an estimate.
  const pad = 0.012;
  const x = clamp(box.x - pad), y = clamp(box.y - pad);
  const w = clamp(box.x + box.w + pad) - x, h = clamp(box.y + box.h + pad) - y;
  return (
    <div key={n} className="pointer-events-none absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}>
      <div className="absolute inset-0 animate-[pulse_0.8s_ease-in-out_3] rounded bg-yellow-300/35 ring-2 ring-violet-600" />
      {label && <span className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{label}</span>}
    </div>
  );
}

function PdfPage({ doc, num, width, focus }: { doc: pdfjs.PDFDocumentProxy; num: number; width: number; focus: Focus | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(11 / 8.5);
  const [visible, setVisible] = useState(num <= 2);

  useEffect(() => {
    let alive = true;
    doc.getPage(num).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (alive) setRatio(v.height / v.width);
    });
    return () => { alive = false; };
  }, [doc, num]);

  // Only draw pages near the screen (packets can be 25+ pages).
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current || width < 50) return;
    let task: pdfjs.RenderTask | null = null;
    let alive = true;
    doc.getPage(num).then((p) => {
      if (!alive || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      task = p.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => undefined);
    });
    return () => { alive = false; task?.cancel(); };
  }, [doc, num, width, visible]);

  useEffect(() => {
    if (focus?.page === num && holder.current) {
      const target = focus.box ? holder.current.offsetTop + focus.box.y * holder.current.offsetHeight - 120 : holder.current.offsetTop - 8;
      holder.current.parentElement?.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
  }, [focus, num]);

  return (
    <div ref={holder} data-page={num} className="relative mx-auto mb-3 bg-white shadow" style={{ width, height: width * ratio }}>
      <canvas ref={canvas} className="h-full w-full" />
      <span className="absolute bottom-1 right-2 rounded bg-slate-900/60 px-1.5 text-[10px] text-white">{num}</span>
      {focus?.page === num && <Highlight box={focus.box} label={focus.label} n={focus.n} />}
    </div>
  );
}

export function PageViewer({ documentId, mimeType, focus, height = "calc(100vh - 150px)" }: { documentId: number; mimeType: string; focus: Focus | null; height?: string }) {
  const url = `/api/documents/${documentId}/file`;
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(600);
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth - 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isPdf) return;
    setDoc(null);
    setError(null);
    let alive = true; // a cancelled load (e.g. after switching documents) must not overwrite the current one
    const task = pdfjs.getDocument({ url, withCredentials: true });
    task.promise.then((d) => alive && setDoc(d), () => alive && setError("This PDF couldn't be shown here. Use “Open” to view it."));
    return () => { alive = false; task.destroy(); };
  }, [url, isPdf]);

  const width = Math.max(200, boxWidth * zoom);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ height }}>
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-1">
        {doc && <span className="px-1 text-xs text-slate-500">{doc.numPages} page{doc.numPages === 1 ? "" : "s"}</span>}
        <span className="ml-auto" />
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"><ZoomOut size={14} /></button>
        <span className="w-10 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in"><ZoomIn size={14} /></button>
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
      </div>
      <div ref={scroller} className="relative flex-1 overflow-auto p-3">
        {isPdf ? (
          error ? <div className="p-6 text-sm text-slate-500">{error}</div>
          : !doc ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Opening…</div>
          : Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} num={i + 1} width={width} focus={focus} />)
        ) : mimeType.startsWith("image/") && mimeType !== "image/tiff" && mimeType !== "image/heic" ? (
          <div className="relative mx-auto bg-white shadow" style={{ width }}>
            <img src={url} alt="Document" className="block w-full" />
            {focus && <Highlight box={focus.box} label={focus.label} n={focus.n} />}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">This file type can't be previewed here. Use “Open” to download it.</div>
        )}
      </div>
    </div>
  );
}
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
// A form field that shows where its value came from: read by the AI (purple), checked by a person (green),
// changed after the AI read it (amber) or typed by hand. Focusing an AI field jumps the document to where it was read.
import type { ReactNode } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import type { ExtractedField } from "@shared/documents";

export type Origin = "ai" | "checked" | "edited" | "typed" | "empty";

const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();

export function originOf(value: string, ai: ExtractedField | undefined, checked: boolean): Origin {
  if (ai?.value) {
    if (same(value, ai.value)) return checked ? "checked" : "ai";
    return "edited";
  }
  return value.trim() ? "typed" : "empty";
}

export const ORIGIN_INPUT: Record<Origin, string> = {
  ai: "!border-violet-400 bg-violet-50/60 focus:!ring-violet-200",
  checked: "!border-emerald-400 bg-emerald-50/40",
  edited: "!border-amber-400 bg-amber-50/50",
  typed: "",
  empty: "",
};

const DOT: Record<string, string> = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" };
const SURE: Record<string, string> = { high: "sure", medium: "fairly sure", low: "unsure" };

export function AiField({
  id, label, required, value, ai, aiText, checked, disabled, className = "", onChange, onCheck, onUndo, onLocate, onNext, children,
}: {
  id: string; label: string; required?: boolean; value: string; ai?: ExtractedField; /** How to show the AI's value, if not as-is (e.g. a payer name for a payer id). */ aiText?: string; checked: boolean; disabled?: boolean; className?: string;
  onChange: (v: string) => void; onCheck: () => void; onUndo: () => void; onLocate: () => void; onNext: () => void;
  /** Use a custom control (e.g. a select) instead of the text box. */
  children?: (props: { id: string; className: string; onFocus: () => void }) => ReactNode;
}) {
  const origin = originOf(value, ai, checked);
  const inputCls = `input ${ORIGIN_INPUT[origin]}`;
  const onFocus = () => ai?.value && onLocate();
  return (
    <div className={`field ${className}`}>
      <div className="label flex min-h-[18px] items-center gap-1.5">
        <label htmlFor={id} className="truncate">{label}{required && <span className="text-red-500"> *</span>}</label>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {origin === "ai" && (
            <>
              <button type="button" onClick={onLocate} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200" title={`Read by AI (${SURE[ai!.confidence]}). Click to see where on the document.`}>
                <Sparkles size={10} /> AI <span className={`h-1.5 w-1.5 rounded-full ${DOT[ai!.confidence]}`} />
              </button>
              {!disabled && (
                <button type="button" onClick={() => { onCheck(); onNext(); }} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-violet-300 bg-white text-violet-700 hover:bg-emerald-50 hover:text-emerald-700" title="It matches the paper (Enter)" aria-label={`${label} matches the paper`}>
                  <Check size={11} />
                </button>
              )}
            </>
          )}
          {origin === "checked" && (
            <button type="button" onClick={onLocate} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800" title="AI value, checked against the paper. Click to see where.">
              <Check size={10} /> AI · checked
            </button>
          )}
          {origin === "edited" && (
            <>
              <button type="button" onClick={onLocate} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title={`Changed by you. The AI read: “${aiText ?? ai!.value}”. Click to see where.`}>
                Edited
              </button>
              {!disabled && <button type="button" onClick={onUndo} className="rounded-full p-0.5 text-amber-700 hover:bg-amber-100" title="Put the AI's value back"><RotateCcw size={11} /></button>}
            </>
          )}
          {origin === "typed" && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="Typed by hand">Typed</span>}
        </span>
      </div>
      {children ? (
        children({ id, className: inputCls, onFocus })
      ) : (
        <input
          id={id}
          className={inputCls}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && origin === "ai") {
              e.preventDefault();
              onCheck();
              onNext();
            }
          }}
        />
      )}
      {origin === "edited" && <div className="mt-0.5 truncate text-[11px] text-amber-700" title={aiText ?? ai!.value ?? ""}>AI read: “{aiText ?? ai!.value}”</div>}
    </div>
  );
}
```

**c) `PacketParts`: the page map and part cards.** `initialParts()` takes the reader's sections, drops
overlaps, and **joins neighboring pages of the same type** (unless one is marked a duplicate). This is
the safety net for when the AI lists a multi-page document page by page. `checkParts()` finds overlaps
and bad ranges before filing.

```tsx
// Split one file of a packet into documents: each part runs from its first page to its last page and has a type,
// a verified tick, and file-or-set-aside. The reader suggests the parts; the reviewer can change anything.
import { useState } from "react";
import { Combine, Eye, Pencil, Scissors, Trash2 } from "lucide-react";
import type { Doc } from "@/lib/types";
import { Badge } from "./ui";
import { DOC_TYPES, docTypeLabel, type Extraction } from "@shared/documents";

export type Part = { fromPage: number; toPage: number; docType: string; verified: boolean; skip: boolean; summary?: string; belongsTo?: string };
const TYPES = DOC_TYPES.filter((d) => d.code !== "packet");

// One color per document type, used on the page map and the part cards.
const COLOR: Record<string, string> = {
  rx: "bg-sky-500", delivery_ticket: "bg-emerald-500", po: "bg-indigo-500", rfa: "bg-violet-500", rfs: "bg-purple-500", authorization: "bg-teal-500",
  chart_notes: "bg-amber-500", demographics: "bg-cyan-500", insurance_card: "bg-pink-500", referral: "bg-blue-600", eob: "bg-lime-600", other: "bg-slate-400",
};
const colorOf = (p: Part) => (p.skip ? "bg-slate-300" : COLOR[p.docType] ?? "bg-slate-400");

/** Can this file be split by page? (PDFs with a known page count.) */
export const splittable = (d: Doc) => d.mimeType === "application/pdf" && !!d.pageCount;

/** Starting parts for a file: the reader's suggestion, with neighbouring pages of the same document joined. */
export function initialParts(d: Doc, fileIndex: number, e: Extraction | null): Part[] {
  const whole: Part[] = [{ fromPage: 1, toPage: d.pageCount ?? 1, docType: d.docType === "packet" ? "other" : d.docType, verified: !!d.verifiedAt, skip: false }];
  if (!splittable(d)) return whole;
  const n = d.pageCount!;
  const suggested = (e?.sections ?? [])
    .filter((s) => s.fileIndex === fileIndex && s.fromPage >= 1 && s.toPage <= n && s.toPage >= s.fromPage)
    .sort((a, b) => a.fromPage - b.fromPage)
    .filter((s, i, arr) => i === 0 || s.fromPage > arr[i - 1].toPage); // drop overlaps
  if (!suggested.length) return whole;
  const parts: Part[] = [];
  for (const s of suggested) {
    const p: Part = { fromPage: s.fromPage, toPage: s.toPage, docType: TYPES.some((t) => t.code === s.docType) ? s.docType : "other", verified: false, skip: s.belongsTo !== "this_patient", summary: s.summary, belongsTo: s.belongsTo };
    const prev = parts[parts.length - 1];
    // The reader sometimes lists a multi-page document page by page: join consecutive pages of the same document.
    if (prev && prev.toPage + 1 === p.fromPage && prev.docType === p.docType && prev.belongsTo === p.belongsTo && !/duplicate/i.test(`${prev.summary} ${p.summary}`)) {
      prev.toPage = p.toPage;
      if (p.summary && p.summary !== prev.summary && !prev.summary?.includes(p.summary)) prev.summary = prev.summary ? prev.summary : p.summary;
    } else parts.push(p);
  }
  return parts;
}

/** Problems that would stop filing, plus pages that aren't in any part (allowed: they stay in the packet only). */
export function checkParts(d: Doc, parts: Part[]) {
  const n = d.pageCount ?? 1;
  const errors: string[] = [];
  const sorted = [...parts].sort((a, b) => a.fromPage - b.fromPage);
  sorted.forEach((p, i) => {
    if (!Number.isInteger(p.fromPage) || !Number.isInteger(p.toPage) || p.fromPage < 1 || p.toPage > n || p.toPage < p.fromPage) errors.push(`Pages ${p.fromPage}-${p.toPage} aren't valid (this file has ${n} page${n === 1 ? "" : "s"}).`);
    if (i > 0 && p.fromPage <= sorted[i - 1].toPage) errors.push(`Pages ${sorted[i - 1].fromPage}-${sorted[i - 1].toPage} and ${p.fromPage}-${p.toPage} overlap.`);
  });
  const covered = new Set(parts.flatMap((p) => Array.from({ length: Math.max(0, p.toPage - p.fromPage + 1) }, (_, k) => p.fromPage + k)));
  const uncovered = Array.from({ length: n }, (_, k) => k + 1).filter((pg) => !covered.has(pg));
  return { errors, uncovered };
}

const range = (a: number, b: number) => (a === b ? `Page ${a}` : `Pages ${a}–${b}`);

export function PacketParts({ doc, parts, onChange, onView, disabled }: { doc: Doc; parts: Part[]; onChange: (p: Part[]) => void; onView: (page: number) => void; disabled?: boolean }) {
  const canSplit = splittable(doc);
  const n = doc.pageCount ?? 1;
  const [editing, setEditing] = useState<number | null>(null);
  const sorted = parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.fromPage - b.p.fromPage);
  const set = (i: number, patch: Partial<Part>) => onChange(parts.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const { errors, uncovered } = checkParts(doc, parts);
  const partOfPage = (pg: number) => parts.find((p) => pg >= p.fromPage && pg <= p.toPage);

  const split = (i: number) => {
    const p = parts[i];
    const at = Math.floor((p.fromPage + p.toPage) / 2);
    onChange([...parts.slice(0, i), { ...p, toPage: at, verified: false }, { ...p, fromPage: at + 1, verified: false, summary: undefined }, ...parts.slice(i + 1)]);
  };
  const joinNext = (i: number) => {
    const p = parts[i];
    const next = parts.find((q) => q.fromPage === p.toPage + 1);
    if (!next) return;
    onChange(parts.filter((q) => q !== next).map((q) => (q === p ? { ...p, toPage: next.toPage, verified: false } : q)));
  };

  return (
    <div className="space-y-3">
      {canSplit && n > 1 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-2xs text-slate-500">
            <span>Page map: click a page to see it</span>
            <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 rounded-sm bg-slate-300" /> set aside <span className="inline-block h-2 w-3 rounded-sm border border-dashed border-slate-300 bg-white" /> not in a part</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: n }, (_, k) => k + 1).map((pg) => {
              const p = partOfPage(pg);
              return (
                <button key={pg} onClick={() => onView(pg)} title={p ? `${range(p.fromPage, p.toPage)}: ${p.skip ? "set aside" : docTypeLabel(p.docType)}` : `Page ${pg}: not in a part`}
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded text-[10px] font-semibold text-white transition hover:scale-110 ${p ? colorOf(p) : "border border-dashed border-slate-300 bg-white !text-slate-400"}`}>
                  {pg}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(({ p, i }) => (
          <div key={i} className={`flex overflow-hidden rounded-xl border bg-white ${p.belongsTo === "other_patient" ? "border-red-300" : "border-slate-200"} ${p.skip ? "opacity-70" : ""}`}>
            <div className={`w-1.5 shrink-0 ${colorOf(p)}`} />
            <div className="min-w-0 flex-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className={`h-8 rounded-lg border-0 bg-slate-50 px-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 ${p.skip ? "line-through" : ""}`} value={p.docType} disabled={disabled || p.skip} onChange={(e) => set(i, { docType: e.target.value })}>
                  {TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
                <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-navy-700 hover:bg-navy-50" onClick={() => onView(p.fromPage)} title="Show in the viewer">
                  <Eye size={13} /> {canSplit ? `${range(p.fromPage, p.toPage)}${p.toPage > p.fromPage ? ` · ${p.toPage - p.fromPage + 1} pages` : ""}` : "View"}
                </button>
                <span className="ml-auto flex items-center gap-2">
                  {canSplit && (
                    <span className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
                      <button disabled={disabled} className={`px-2.5 py-1 ${!p.skip ? "bg-navy-800 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => set(i, { skip: false })}>File</button>
                      <button disabled={disabled} className={`px-2.5 py-1 ${p.skip ? "bg-slate-600 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => set(i, { skip: true, verified: false })}>Set aside</button>
                    </span>
                  )}
                  {!p.skip && (
                    <label className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs ${p.verified ? "border-accent-300 bg-accent-50 text-accent-800" : "border-slate-200 text-slate-600"}`}>
                      <input type="checkbox" className="h-3.5 w-3.5" checked={p.verified} disabled={disabled} onChange={(e) => set(i, { verified: e.target.checked })} /> Verified
                    </label>
                  )}
                </span>
              </div>
              {(p.summary || p.belongsTo === "other_patient" || p.belongsTo === "none") && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {p.belongsTo === "other_patient" && <Badge tone="red">AI: about a different person</Badge>}
                  {p.belongsTo === "none" && <Badge tone="slate">AI: cover sheet / blank / junk</Badge>}
                  <span>{p.summary}</span>
                </div>
              )}
              {canSplit && !disabled && (
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  {editing === i ? (
                    <span className="flex items-center gap-1 text-slate-500">
                      Pages
                      <input type="number" min={1} max={n} className="input h-7 w-14 px-2 text-xs" value={p.fromPage} onChange={(e) => set(i, { fromPage: Number(e.target.value) })} aria-label="First page" />
                      to
                      <input type="number" min={1} max={n} className="input h-7 w-14 px-2 text-xs" value={p.toPage} onChange={(e) => set(i, { toPage: Number(e.target.value) })} aria-label="Last page" />
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Done</button>
                    </span>
                  ) : (
                    <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => setEditing(i)}><Pencil size={12} /> Edit pages</button>
                  )}
                  {p.toPage > p.fromPage && <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => split(i)} title="Split this part in two"><Scissors size={12} /> Split</button>}
                  {parts.some((q) => q.fromPage === p.toPage + 1) && <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => joinNext(i)} title="Join with the next part"><Combine size={12} /> Join with next</button>}
                  {parts.length > 1 && <button className="btn btn-ghost btn-sm ml-auto text-slate-400 hover:text-red-600" onClick={() => onChange(parts.filter((_, k) => k !== i))} title="Remove this part (its pages stay in the packet only)"><Trash2 size={12} /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {canSplit && !disabled && uncovered.length > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([...parts, { fromPage: uncovered[0], toPage: uncovered.find((pg, k) => uncovered[k + 1] !== pg + 1) ?? uncovered[0], docType: "other", verified: false, skip: false }])}>
          + Add a part for page {uncovered[0]}{uncovered.length > 1 ? " onward" : ""}
        </button>
      )}
      {errors.map((e) => <div key={e} className="text-xs text-red-600">{e}</div>)}
      {uncovered.length > 0 && <div className="text-xs text-slate-500">Pages {uncovered.join(", ")} aren't in any part. They stay in the full packet in the Inbox only.</div>}
    </div>
  );
}
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
// The Inbox: faxes, emails and uploads land here. The reader fills in what it can; a person checks every
// value against the paper, decides "new patient" or "existing patient", and files it.
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, Search, CheckCircle2, FileText, Inbox, Loader2, Mail, Printer, RefreshCw, Sparkles, Upload, UserCheck, UserPlus, XCircle } from "lucide-react";
import { ApiError, get, post, uploadFiles } from "@/lib/api";
import { useNav } from "@/lib/nav";
import { useSession } from "@/lib/session";
import type { Doc, Payer } from "@/lib/types";
import { Page } from "@/components/Shell";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Modal, Select } from "@/components/inputs";
import { PageViewer, type Focus } from "@/components/PageViewer";
import { AiField, originOf } from "@/components/AiField";
import { PacketParts, checkParts, initialParts, splittable, type Part } from "@/components/PacketParts";
import type { Extraction, ExtractedField } from "@shared/documents";
import { PAYER_TYPES } from "@shared/picklists";
import { isoToDisplay } from "@shared/dates";

type Row = { id: number; source: string; sender: string | null; subject: string | null; receivedAt: string; status: string; reader: string | null; decision: string | null; patientId: number | null; completedAt: string | null; completedBy: string | null; docCount: number; foundName: string | null };
type Match = { patientId: number; accountNumber: string; lastName: string; firstName: string; dob: string; score: number; reasons: string[] };
type Item = Row & { extraction: Extraction | null; readerError: string | null; suggestedPatientId: number | null; documents: Doc[]; matches: Match[] };

const SOURCE: Record<string, { label: string; icon: ReactElement }> = {
  fax: { label: "Fax", icon: <Printer size={15} /> },
  email: { label: "Email", icon: <Mail size={15} /> },
  upload: { label: "Upload", icon: <Upload size={15} /> },
  client_portal: { label: "Client portal", icon: <Upload size={15} /> },
  patient_portal: { label: "Patient portal", icon: <Upload size={15} /> },
  api: { label: "API", icon: <Bot size={15} /> },
};
const READER: Record<string, string> = { claude: "AI reader", demo: "Demo reader", manual: "Typed by hand" };

export function InboxScreen() {
  const { aiReader, aiReaderNote } = useSession();
  const nav = useNav();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [source, setSource] = useState("upload");
  const [sender, setSender] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useQuery({ queryKey: ["intake", tab], queryFn: () => get<Row[]>(`/api/intake${tab === "done" ? "?status=done" : ""}`), refetchInterval: (q) => (q.state.data?.some((r) => r.status === "reading") ? 2000 : false) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["intake"] });
  const up = useMutation({
    mutationFn: (files: File[]) => uploadFiles<{ id: number }>("/api/intake", files, { source, sender }),
    onSuccess: (r) => { refresh(); toast("Received. Reading it now…"); nav.go({ name: "intake", id: r.id }); },
  });
  const demo = useMutation({ mutationFn: (kind: "new" | "existing") => post<{ id: number }>("/api/intake/demo", { kind }), onSuccess: () => { refresh(); toast("A sample just arrived in the Inbox."); } });

  return (
    <Page
      title="Inbox"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          New paperwork from fax, email, the portals and the API. Open each one, check what was read, and file it to a patient.
          <Badge tone={aiReader === "on" ? "green" : "slate"}><Bot size={11} /> {aiReaderNote}</Badge>
        </span>
      }
      actions={
        <>
          <button className="btn btn-sm" onClick={() => demo.mutate("new")} title="Practice with fake paperwork"><Sparkles size={14} /> Sample: new patient fax</button>
          <button className="btn btn-sm" onClick={() => demo.mutate("existing")}><Sparkles size={14} /> Sample: existing patient email</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-slate-100 px-3">
            {(["open", "done"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`relative px-3 py-3 text-sm font-medium ${tab === t ? "text-navy-800" : "text-slate-500 hover:text-slate-800"}`}>
                {t === "open" ? "To file" : "Filed"}
                {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-800" />}
              </button>
            ))}
          </div>
          {list.data?.length === 0 && <EmptyState icon={<Inbox size={20} />} title={tab === "open" ? "Inbox is clear" : "Nothing filed yet"} body={tab === "open" ? "New faxes and emails show up here by themselves." : undefined} />}
          <ul className="divide-y divide-slate-50">
            {list.data?.map((r) => (
              <li key={r.id}>
                <button className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50" onClick={() => (r.status === "done" && r.patientId ? nav.openPatient(r.patientId, r.foundName ?? "Patient", "documents") : nav.go({ name: "intake", id: r.id }))}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{SOURCE[r.source]?.icon ?? <FileText size={15} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{r.foundName ?? "Name not read yet"}</span>
                      {r.status === "reading" && <Badge tone="navy"><Loader2 size={11} className="animate-spin" /> Reading</Badge>}
                      {r.status === "review" && <Badge tone="amber">Needs review</Badge>}
                      {r.status === "done" && <Badge tone="green">{r.decision === "new" ? "New patient" : "Existing patient"}</Badge>}
                      {r.status === "rejected" && <Badge tone="red">Not filed</Badge>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {SOURCE[r.source]?.label ?? r.source}{r.sender ? ` · ${r.sender}` : ""}{r.subject ? ` · ${r.subject}` : ""} · {r.docCount} file{r.docCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-right text-xs text-slate-400">
                    {new Date(r.receivedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {r.completedBy && <span className="block">by {r.completedBy}</span>}
                  </span>
                  <ArrowRight size={15} className="text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card self-start p-4">
          <div className="card-title mb-1">Add paperwork</div>
          <p className="mb-3 text-xs text-slate-500">Scanned or saved files. Several files can be one packet (Rx, delivery ticket, PO…).</p>
          <div className="space-y-2">
            <Select value={source} onChange={setSource} options={[{ code: "upload", label: "Scanned / uploaded" }, { code: "fax", label: "Came by fax" }, { code: "email", label: "Came by email" }]} />
            <input className="input" placeholder="From (fax number, email, clinic)…" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={120} />
          </div>
          <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.length && up.mutate([...e.target.files])} />
          <button
            className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-500 hover:border-navy-300 hover:text-navy-700"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) up.mutate([...e.dataTransfer.files]); }}
          >
            {up.isPending ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {up.isPending ? "Uploading…" : "Drop files or click to choose"}
            <span className="text-2xs text-slate-400">PDF or image, up to 25 MB each</span>
          </button>
          <div className="mt-2"><ErrorBox error={up.error ?? demo.error} /></div>
        </div>
      </div>
    </Page>
  );
}

// ---- Review one item -------------------------------------------------------------------

const PATIENT_FIELDS: { key: keyof Extraction["patient"]; label: string; span?: string; required?: boolean }[] = [
  { key: "lastName", label: "Last name", required: true },
  { key: "firstName", label: "First name", required: true },
  { key: "middleInitial", label: "MI", span: "col-span-1" },
  { key: "dob", label: "Date of birth (YYYY-MM-DD)", required: true },
  { key: "sex", label: "Sex (F/M/U)", required: true },
  { key: "ssn", label: "SSN" },
  { key: "address1", label: "Address", span: "col-span-2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "phone", label: "Phone" },
  { key: "cellPhone", label: "Cell" },
  { key: "email", label: "Email" },
  { key: "employer", label: "Employer" },
];
const INS_FIELDS = [
  ["claimNumber", "Claim #"], ["memberId", "Member ID"], ["groupNumber", "Group #"], ["dateOfInjury", "Date of injury (YYYY-MM-DD)"],
  ["employerName", "Employer"], ["adjusterName", "Adjuster"], ["adjusterPhone", "Adjuster phone"], ["referralNumber", "VA referral #"], ["authorizationNumber", "Authorization #"],
] as const;
type InsKey = (typeof INS_FIELDS)[number][0];
type InsForm = { rank: number; payerId: number; payerGuess: string; values: Record<InsKey, string>; ai: Partial<Record<InsKey | "payer", ExtractedField>> };


function guessPayer(payers: Payer[], name: string | null, type: string) {
  const n = (name ?? "").toLowerCase();
  const byName = n ? payers.find((p) => p.name.toLowerCase() === n) ?? payers.find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n)) : undefined;
  return byName ?? payers.find((p) => p.payerType === type);
}

export function IntakeReview({ id }: { id: number }) {
  const nav = useNav();
  const qc = useQueryClient();
  const toast = useToast();
  const { aiReader, aiReaderNote } = useSession();
  const q = useQuery({ queryKey: ["intake", "item", id], queryFn: () => get<Item>(`/api/intake/${id}`), refetchInterval: (x) => (x.state.data?.status === "reading" ? 1500 : false) });
  const payers = useQuery({ queryKey: ["payers"], queryFn: () => get<Payer[]>("/api/payers"), staleTime: 300_000 });
  const item = q.data;

  const [docIdx, setDocIdx] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [aiP, setAiP] = useState<Record<string, ExtractedField>>({}); // what the AI read for each patient field
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // AI values a person confirmed ("p.lastName", "i0.claimNumber")
  const [focus, setFocus] = useState<Focus | null>(null);
  const [ins, setIns] = useState<InsForm[]>([]);
  const [coverage, setCoverage] = useState("WC");
  const [parts, setParts] = useState<Record<number, Part[]>>({});
  const [slots, setSlots] = useState<Record<number, string>>({}); // existing patient: where each read insurance goes
  const [chosen, setChosen] = useState<{ id: number; label: string } | null>(null); // picked by search, not suggested
  const [decision, setDecision] = useState<"new" | "existing" | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [applyUpdates, setApplyUpdates] = useState(false);
  const [notDup, setNotDup] = useState(false);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form once from what the reader found (again if it is re-read).
  useEffect(() => {
    if (!item || item.status === "reading" || !payers.data) return;
    const stamp = `${item.id}:${item.reader}:${JSON.stringify(item.extraction)?.length}`;
    if (loadedFor === stamp) return;
    setLoadedFor(stamp);
    const e = item.extraction;
    const f: Record<string, string> = {};
    const a: Record<string, ExtractedField> = {};
    if (e) for (const k of PATIENT_FIELDS) { const v = e.patient[k.key] as ExtractedField; f[k.key] = v.value ?? ""; if (v.value) a[k.key] = v; }
    setFields(f);
    setAiP(a);
    setChecked({});
    setFocus(null);
    setIns((e?.insurances ?? []).map((i) => {
      const values = Object.fromEntries(INS_FIELDS.map(([k]) => [k, (i[k] as ExtractedField).value ?? ""])) as Record<InsKey, string>;
      const ai = Object.fromEntries(INS_FIELDS.filter(([k]) => (i[k] as ExtractedField).value).map(([k]) => [k, i[k] as ExtractedField]));
      const payerId = guessPayer(payers.data, i.payerName.value, i.payerTypeGuess)?.id ?? 0;
      return { rank: i.rank, payerId, payerGuess: i.payerName.value ?? "", values, ai: { ...ai, ...(i.payerName.value && payerId ? { payer: { ...i.payerName, value: String(payerId) } } : {}) } };
    }));
    const t = e?.insurances[0]?.payerTypeGuess;
    if (t && t !== "UNKNOWN") setCoverage(t);
    setParts(Object.fromEntries(item.documents.map((d, i) => [d.id, initialParts(d, i, e)])));
    setSlots({});
    const top = item.matches[0];
    if (top && top.score >= 80) { setDecision("existing"); setPick(top.patientId); }
    else if (top) { setDecision(null); setPick(null); }
    else setDecision("new");
  }, [item, payers.data, loadedFor]);

  // Existing patient: what's on file now, so the reviewer can choose where each insurance / claim goes.
  const existing = useQuery({
    queryKey: ["patient", pick],
    queryFn: () => get<{ firstName: string; lastName: string; dob: string; sex: string; insurances: { rank: number; payerName: string; payerType: string; claimNumber: string | null; referralNumber: string | null; authorizationNumber: string | null }[] }>(`/api/patients/${pick}`),
    enabled: decision === "existing" && !!pick,
  });
  const onFile = existing.data?.insurances ?? [];
  const norm = (v?: string | null) => (v ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const defaultSlot = (i: InsForm, n: number) => {
    const same = onFile.find((f) => (norm(i.values.claimNumber) && norm(f.claimNumber) === norm(i.values.claimNumber)) || (norm(i.values.referralNumber) && norm(f.referralNumber) === norm(i.values.referralNumber)));
    if (same) return `update:${same.rank}`;
    const taken = new Set([...onFile.map((f) => f.rank), ...ins.slice(0, n).map((x, k) => Number((slots[k] ?? "").split(":")[1]) || 0)]);
    const free = [1, 2, 3].find((r) => !taken.has(r));
    return free ? `add:${free}` : "skip";
  };
  const slotOf = (n: number) => slots[n] ?? defaultSlot(ins[n], n);
  const planned = ins.map((i, n) => ({ i, n, slot: slotOf(n) })).filter((x) => x.slot !== "skip");
  const slotClash = new Set(planned.map((x) => x.slot.split(":")[1])).size !== planned.length;

  const fileParts = item ? item.documents.flatMap((d) => (parts[d.id] ?? []).filter((p) => !p.skip)) : [];
  const allVerified = fileParts.every((p) => p.verified);
  const partErrors = item ? item.documents.flatMap((d) => (splittable(d) ? checkParts(d, parts[d.id] ?? []).errors : [])) : [];
  const patientPayload = useMemo(() => {
    const p: Record<string, unknown> = { coverageType: coverage };
    for (const k of PATIENT_FIELDS) if (fields[k.key]?.trim()) p[k.key] = fields[k.key].trim();
    if (p.sex) p.sex = String(p.sex).toUpperCase().slice(0, 1);
    if (p.state) p.state = String(p.state).toUpperCase().slice(0, 2);
    p.insurances = ins.filter((i) => i.payerId).map((i) => {
      const o: Record<string, unknown> = { rank: i.rank, payerId: i.payerId, relationshipToInsured: "18", subscriberLastName: p.lastName, subscriberFirstName: p.firstName, subscriberDob: p.dob, subscriberSex: p.sex };
      for (const [k] of INS_FIELDS) if (i.values[k]?.trim()) o[k] = i.values[k].trim();
      return o;
    });
    return p;
  }, [fields, ins, coverage]);

  /** Existing patient: only the insurances going into chosen slots, plus the details if "also update" is ticked. */
  function existingPayload() {
    const { insurances: _ignored, coverageType: _c, ...details } = patientPayload as Record<string, unknown>;
    const who = existing.data;
    const insurances = planned.map(({ i, slot }) => {
      const [mode, rank] = slot.split(":");
      const o: Record<string, unknown> = { rank: Number(rank), payerId: i.payerId, relationshipToInsured: "18" };
      if (mode !== "update" && who) Object.assign(o, { subscriberLastName: who.lastName, subscriberFirstName: who.firstName, subscriberDob: who.dob, subscriberSex: who.sex });
      for (const [k] of INS_FIELDS) if (i.values[k]?.trim()) o[k] = i.values[k].trim();
      return o;
    });
    return { ...(applyUpdates ? details : {}), insurances };
  }

  const complete = useMutation({
    mutationFn: () =>
      post<{ patientId: number }>(`/api/intake/${id}/complete`, {
        decision,
        patientId: decision === "existing" ? pick ?? undefined : undefined,
        patient: decision === "new" ? patientPayload : existingPayload(),
        applyUpdates: decision === "existing" && applyUpdates,
        replaceRanks: decision === "existing" ? planned.filter((x) => x.slot.startsWith("replace")).map((x) => Number(x.slot.split(":")[1])) : [],
        confirmNotDuplicate: notDup,
        documents: item!.documents.map((d) => {
          const ps = parts[d.id] ?? [];
          if (splittable(d)) return { id: d.id, docType: ps[0]?.docType ?? "other", verified: false, sections: ps.map(({ fromPage, toPage, docType, verified, skip }) => ({ fromPage, toPage, docType, verified, skip })) };
          return { id: d.id, docType: ps[0]?.docType ?? d.docType, verified: !!ps[0]?.verified };
        }),
        note: note.trim() || undefined,
        fieldReview: fieldReview(),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["intake"] });
      toast(decision === "new" ? "New patient created and paperwork filed." : "Paperwork filed to the patient.");
      const label = decision === "existing" ? (() => { const m = item!.matches.find((x) => x.patientId === pick); return m ? `${m.lastName}, ${m.firstName}` : chosen?.label ?? "Patient"; })() : `${fields.lastName}, ${fields.firstName}`;
      nav.openPatient(r.patientId, label, "overview");
    },
  });
  const reject = useMutation({ mutationFn: () => post(`/api/intake/${id}/reject`, { reason }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["intake"] }); toast("Marked as not filed."); nav.go({ name: "inbox" }); } });
  const reread = useMutation({ mutationFn: () => post(`/api/intake/${id}/reread`), onSuccess: () => { setLoadedFor(null); q.refetch(); } });

  if (q.isLoading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!item) return <div className="p-10"><ErrorBox error={q.error} /></div>;
  const handled = item.status === "done" || item.status === "rejected";
  const current = item.documents[docIdx] ?? item.documents[0];
  const isDupError = complete.error instanceof ApiError && complete.error.status === 409 && decision === "new";
  const missingRequired = decision === "new" ? PATIENT_FIELDS.filter((f) => f.required && !fields[f.key]?.trim()).map((f) => f.label) : [];
  const insProblems = decision === "existing" ? [...(slotClash ? ["Two insurances are going into the same slot."] : []), ...(planned.some((x) => !x.i.payerId) ? ["Choose the payer for each insurance you're saving."] : [])] : [];
  const canFile = !handled && decision && (decision === "new" || pick) && missingRequired.length === 0 && partErrors.length === 0 && insProblems.length === 0;
  let step = 1;
  // ---- AI-read fields: where each came from, checking them one by one -----------------------------
  const labelOf = (key: string) => {
    const [scope, k] = key.split(".");
    if (scope === "p") return PATIENT_FIELDS.find((f) => f.key === k)?.label ?? k;
    return k === "payer" ? "Payer" : INS_FIELDS.find(([x]) => x === k)?.[1] ?? k;
  };
  /** Jump the document to where the AI read this value, and highlight it. */
  function locate(key: string, ai?: ExtractedField) {
    const w = ai?.where;
    if (!w || !item) return;
    if (w.file >= 0 && w.file < item.documents.length) setDocIdx(w.file);
    setFocus({ page: Math.max(1, w.page), box: w.box && w.box.w > 0 && w.box.h > 0 ? w.box : null, label: `${labelOf(key)}${w.box ? "" : ` (page ${w.page})`}`, n: Date.now() });
  }
  // Every AI-read field currently on screen, in screen order.
  const showPatient = decision === "new" || applyUpdates;
  const showIns = (n: number) => decision === "new" || (decision === "existing" && !!pick && slotOf(n) !== "skip");
  const aiFields: { key: string; ai: ExtractedField; value: string }[] = [
    ...(showPatient ? PATIENT_FIELDS.filter((f) => aiP[f.key]).map((f) => ({ key: `p.${f.key}`, ai: aiP[f.key], value: fields[f.key] ?? "" })) : []),
    ...ins.flatMap((i, n) => (showIns(n) ? [
      ...(i.ai.payer ? [{ key: `i${n}.payer`, ai: i.ai.payer, value: String(i.payerId || "") }] : []),
      ...INS_FIELDS.filter(([k]) => i.ai[k]).map(([k]) => ({ key: `i${n}.${k}`, ai: i.ai[k]!, value: i.values[k] })),
    ] : [])),
  ];
  const tally = aiFields.reduce((t, f) => { t[originOf(f.value, f.ai, !!checked[f.key])]++; return t; }, { ai: 0, checked: 0, edited: 0, typed: 0, empty: 0 });
  /** Move to the next AI field that still needs checking. */
  function goNext(after?: string) {
    const start = after ? aiFields.findIndex((f) => f.key === after) + 1 : 0;
    const order = [...aiFields.slice(start), ...aiFields.slice(0, start)];
    const next = order.find((f) => f.key !== after && originOf(f.value, f.ai, !!checked[f.key]) === "ai");
    if (!next) return;
    const el = document.getElementById(`f-${next.key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
    locate(next.key, next.ai);
  }
  const fieldProps = (key: string, ai: ExtractedField | undefined, value: string, onChange: (v: string) => void) => ({
    id: `f-${key}`, value, ai, checked: !!checked[key], disabled: handled, onChange,
    onCheck: () => setChecked((c) => ({ ...c, [key]: true })),
    onUndo: () => ai?.value && onChange(ai.value),
    onLocate: () => locate(key, ai),
    onNext: () => goNext(key),
  });
  /** What happened to each AI value, saved with the filing so accuracy can be measured. */
  const fieldReview = () => aiFields.map((f) => ({ field: f.key, label: labelOf(f.key), aiValue: f.ai.value, finalValue: f.value || null, confidence: f.ai.confidence, outcome: originOf(f.value, f.ai, !!checked[f.key]) }));

  const setInsValue = (n: number, k: InsKey, v: string) => setIns((x) => x.map((y, m) => (m === n ? { ...y, values: { ...y.values, [k]: v } } : y)));
  const insCard = (i: InsForm, n: number, top?: ReactNode) => (
    <div key={n} className="mb-3 rounded-lg border border-slate-200 p-3">
      {top}
      <div className="mb-2 grid grid-cols-3 gap-3">
        <AiField {...fieldProps(`i${n}.payer`, i.ai.payer, String(i.payerId || ""), (v) => setIns((x) => x.map((y, m) => (m === n ? { ...y, payerId: Number(v) } : y))))} aiText={i.payerGuess}
          label={`${decision === "new" ? `${["Primary", "Secondary", "Tertiary"][i.rank - 1]} payer` : "Payer"}${i.payerGuess ? ` (paper says “${i.payerGuess}”)` : ""}`} className="col-span-2">
          {({ id: fid, className, onFocus }) => (
            <select id={fid} className={`${className} ${!i.payerId ? "!border-red-300" : ""}`} value={i.payerId || ""} disabled={handled} onFocus={onFocus} onChange={(e) => setIns((x) => x.map((y, m) => (m === n ? { ...y, payerId: Number(e.target.value) } : y)))}>
              <option value="">Choose the payer…</option>
              {payers.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </AiField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {INS_FIELDS.map(([k, label]) => <AiField key={k} {...fieldProps(`i${n}.${k}`, i.ai[k], i.values[k], (v) => setInsValue(n, k, v))} label={label} />)}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col xl:flex-row">
      {/* The paper, on the left */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 bg-slate-100/70 p-4 xl:max-w-[52%]">
        <div className="mb-3 flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => nav.go({ name: "inbox" })}>← Inbox</button>
          <span className="text-sm text-slate-600">{SOURCE[item.source]?.label}{item.sender ? ` · ${item.sender}` : ""}</span>
          <span className="ml-auto text-xs text-slate-400">{new Date(item.receivedAt).toLocaleString()}</span>
        </div>
        {item.documents.length > 1 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {item.documents.map((d, i) => (
              <button key={d.id} onClick={() => { setDocIdx(i); setFocus(null); }} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${i === docIdx ? "bg-navy-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {(parts[d.id] ?? []).every((p) => p.skip || p.verified) ? <CheckCircle2 size={12} /> : <FileText size={12} />} File {i + 1}{d.pageCount && d.pageCount > 1 ? ` (${d.pageCount} pages)` : ""}
              </button>
            ))}
          </div>
        )}
        {current && <PageViewer documentId={current.id} mimeType={current.mimeType} focus={focus} />}
      </div>

      {/* The review, on the right */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {item.status === "reading" ? (
          <div className="card flex items-center gap-3 p-6 text-slate-600"><Loader2 className="animate-spin text-navy-600" /> Reading the paperwork… This page fills in by itself.</div>
        ) : (
          <div className="space-y-5">
            <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${item.reader === "manual" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-navy-100 bg-navy-50/60 text-navy-900"}`}>
              {item.reader === "manual" ? <AlertTriangle size={18} className="shrink-0" /> : <Bot size={18} className="shrink-0" />}
              <div className="flex-1">
                <div className="font-medium">{READER[item.reader ?? "manual"]}{item.reader !== "claude" && aiReader === "off" ? ` (${aiReaderNote})` : ""}</div>
                <div className="mt-0.5 text-xs opacity-80">
                  {item.reader === "manual" ? "Type the details from the paper on the left." : "Check every value against the paper. Red = the reader wasn't sure. Amber = fairly sure. Nothing is saved until you file it."}
                  {item.extraction?.readerNotes ? ` Reader notes: ${item.extraction.readerNotes}` : ""}
                  {item.readerError ? ` ${item.readerError}` : ""}
                </div>
              </div>
              {!handled && <button className="btn btn-ghost btn-sm" onClick={() => reread.mutate()} title="Read again"><RefreshCw size={14} /></button>}
            </div>

            {aiFields.length > 0 && !handled && (
              <div className="sticky top-0 z-10 rounded-xl border border-violet-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center gap-3">
                  <Sparkles size={16} className="text-violet-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {tally.checked + tally.edited} of {aiFields.length} AI values checked{tally.edited ? ` · ${tally.edited} corrected` : ""}
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="bg-emerald-500" style={{ width: `${(tally.checked / aiFields.length) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(tally.edited / aiFields.length) * 100}%` }} />
                    </div>
                  </div>
                  <button className="btn btn-sm border-violet-300 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50" disabled={tally.ai === 0} onClick={() => goNext()}>
                    {tally.ai === 0 ? "All checked" : `Check next (${tally.ai} left)`}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-slate-500">
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-violet-400 bg-violet-50" />AI, not checked yet</span>
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-emerald-400 bg-emerald-50" />AI, checked</span>
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-amber-400 bg-amber-50" />Corrected by you</span>
                  <span>Click a field to jump to where it was read · Enter = “it matches the paper”</span>
                </div>
              </div>
            )}

            {handled && <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">This paperwork was {item.status === "done" ? `filed by ${item.completedBy}` : `set aside by ${item.completedBy}`}.</div>}

            {/* 1. New or existing? */}
            <section className="card p-5">
              <div className="mb-3 font-semibold text-slate-900">{step++}. Is this a new patient or one we already have?</div>
              {item.matches.length > 0 ? (
                <div className="space-y-2">
                  {item.matches.map((m) => (
                    <label key={m.patientId} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "existing" && pick === m.patientId ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" checked={decision === "existing" && pick === m.patientId} onChange={() => { setDecision("existing"); setPick(m.patientId); setSlots({}); }} disabled={handled} />
                      <UserCheck size={16} className="text-navy-600" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-900">{m.lastName}, {m.firstName}</span>
                        <span className="ml-2 text-xs text-slate-500">#{m.accountNumber} · DOB {isoToDisplay(m.dob)}</span>
                        <span className="block text-2xs text-slate-500">{m.reasons.join(" · ")}</span>
                      </span>
                      <Badge tone={m.score >= 80 ? "green" : m.score >= 60 ? "amber" : "slate"}>{m.score >= 80 ? "Strong match" : m.score >= 60 ? "Possible" : "Weak"}</Badge>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mb-2 text-sm text-slate-500">No one in this client matches the name, date of birth, SSN, phone or claim number.</div>
              )}
              {chosen && !item.matches.some((m) => m.patientId === chosen.id) && (
                <label className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "existing" && pick === chosen.id ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" checked={decision === "existing" && pick === chosen.id} onChange={() => { setDecision("existing"); setPick(chosen.id); }} disabled={handled} />
                  <UserCheck size={16} className="text-navy-600" />
                  <span className="flex-1 font-medium text-slate-900">{chosen.label}</span>
                  <Badge tone="navy">Picked by you</Badge>
                </label>
              )}
              {!handled && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => nav.pickPatient("File this paperwork to…", (pid, label) => { setChosen({ id: pid, label }); setDecision("existing"); setPick(pid); setSlots({}); })}>
                  <Search size={14} /> Pick a different existing patient…
                </button>
              )}
              <label className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "new" ? "border-accent-400 bg-accent-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" checked={decision === "new"} onChange={() => { setDecision("new"); setPick(null); }} disabled={handled} />
                <UserPlus size={16} className="text-accent-700" />
                <span className="font-medium text-slate-900">New patient: create a new account</span>
              </label>
              {decision === "existing" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={applyUpdates} onChange={(e) => setApplyUpdates(e.target.checked)} disabled={handled} />
                  Also update this patient's name, address, phone and other details (filled-in values replace what's on file)
                </label>
              )}
            </section>

            {/* 2. Patient details */}
            {(decision === "new" || applyUpdates) && (
              <section className="card p-5">
                <div className="mb-3 font-semibold text-slate-900">{step++}. Patient details</div>
                <div className="grid grid-cols-3 gap-3">
                  {PATIENT_FIELDS.map((f) => (
                    <AiField key={f.key} {...fieldProps(`p.${f.key}`, aiP[f.key], fields[f.key] ?? "", (v) => setFields((x) => ({ ...x, [f.key]: v })))} label={f.label} required={f.required} className={f.span ?? ""} />
                  ))}
                  {decision === "new" && (
                    <label className="field">
                      <span className="label">Main coverage <span className="text-red-500">*</span></span>
                      <Select value={coverage} onChange={setCoverage} options={PAYER_TYPES} disabled={handled} />
                    </label>
                  )}
                </div>
                {decision === "new" && <>
                <div className="mt-5 mb-2 text-sm font-semibold text-slate-800">Insurance</div>
                {ins.length === 0 && <div className="text-sm text-slate-400">No insurance was read. Add it now or later on the patient's file.</div>}
                {ins.map((i, n) => insCard(i, n))}
                {!handled && ins.length < 3 && (
                  <button className="btn btn-sm" onClick={() => setIns((x) => [...x, { rank: x.length + 1, payerId: 0, payerGuess: "", values: Object.fromEntries(INS_FIELDS.map(([k]) => [k, ""])) as Record<InsKey, string>, ai: {} }])}>+ Add insurance</button>
                )}
                </>}
                {(item.extraction?.diagnosisCodes.length || item.extraction?.hcpcsCodes.length || item.extraction?.orderingPhysician.value) ? (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-1 font-medium text-slate-700">Also read (use when posting charges)</div>
                    {item.extraction?.orderingPhysician.value && <div>Ordering physician: {item.extraction.orderingPhysician.value}</div>}
                    {!!item.extraction?.diagnosisCodes.length && <div>Diagnosis codes: <span className="font-mono">{item.extraction.diagnosisCodes.join(", ")}</span></div>}
                    {!!item.extraction?.hcpcsCodes.length && <div>HCPCS: <span className="font-mono">{item.extraction.hcpcsCodes.join(", ")}</span></div>}
                  </div>
                ) : null}
              </section>
            )}

            {/* Existing patient: where each insurance / claim goes */}
            {decision === "existing" && pick && (
              <section className="card p-5">
                <div className="mb-1 font-semibold text-slate-900">{step++}. Insurance and claims</div>
                <p className="mb-3 text-xs text-slate-500">Choose where each insurance from the paperwork goes. "Add" puts a new claim in an empty slot (e.g. a second injury). "Update" adds new details, like a new authorization number, to a claim on file. "Replace" overwrites a slot completely.</p>
                <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="mb-1 font-medium text-slate-700">On file now</div>
                  {[1, 2, 3].map((r) => {
                    const f = onFile.find((x) => x.rank === r);
                    return <div key={r} className="text-slate-600">Slot {r}: {f ? `${f.payerName}${f.claimNumber ? ` · claim ${f.claimNumber}` : ""}${f.referralNumber ? ` · referral ${f.referralNumber}` : ""}${f.authorizationNumber ? ` · auth ${f.authorizationNumber}` : ""}` : <span className="text-slate-400">empty</span>}</div>;
                  })}
                </div>
                {ins.length === 0 && <div className="text-sm text-slate-400">No insurance was read from this paperwork.</div>}
                {ins.map((i, n) =>
                  insCard(i, n, (
                    <label className="field mb-2">
                      <span className="label">Where should this go?</span>
                      <select className="input" value={slotOf(n)} disabled={handled} onChange={(e) => setSlots((x) => ({ ...x, [n]: e.target.value }))}>
                        <option value="skip">Don't save this insurance</option>
                        {[1, 2, 3].map((r) => {
                          const f = onFile.find((x) => x.rank === r);
                          return f ? (
                            <optgroup key={r} label={`Slot ${r}: ${f.payerName}${f.claimNumber ? ` (claim ${f.claimNumber})` : ""}`}>
                              <option value={`update:${r}`}>Update slot {r} (same claim; keep what's on file)</option>
                              <option value={`replace:${r}`}>Replace slot {r} completely</option>
                            </optgroup>
                          ) : (
                            <option key={r} value={`add:${r}`}>Add as a new claim in empty slot {r}</option>
                          );
                        })}
                      </select>
                    </label>
                  )),
                )}
                {!handled && ins.length < 3 && (
                  <button className="btn btn-sm" onClick={() => setIns((x) => [...x, { rank: x.length + 1, payerId: 0, payerGuess: "", values: Object.fromEntries(INS_FIELDS.map(([k]) => [k, ""])) as Record<InsKey, string>, ai: {} }])}>+ Add insurance</button>
                )}
                {insProblems.map((m) => <div key={m} className="mt-2 text-xs text-red-600">{m}</div>)}
              </section>
            )}

            {/* Documents */}
            <section className="card p-5">
              <div className="mb-1 font-semibold text-slate-900">{step++}. What's in the packet?</div>
              <p className="mb-3 text-xs text-slate-500">
                Each part becomes its own document on the patient's file, so the ready-to-bill checklist can see it. Check the pages and type of each part; tick "Verified" only when it's the right document, complete and readable.
                Set aside anything that isn't for this patient (cover sheets, junk, someone else's page). The full packet is always kept with this Inbox item.
              </p>
              <div className="space-y-4">
                {item.documents.filter((d) => !d.parentDocumentId).map((d) => {
                  const i = item.documents.indexOf(d);
                  return (
                    <div key={d.id}>
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <button className={`font-medium ${i === docIdx ? "text-navy-800" : "text-navy-600 hover:underline"}`} onClick={() => { setDocIdx(i); setFocus(null); }}>File {i + 1}</button>
                        <span className="truncate text-slate-500">{d.originalName}{d.pageCount ? ` · ${d.pageCount} page${d.pageCount === 1 ? "" : "s"}` : ""}</span>
                      </div>
                      <PacketParts doc={d} parts={parts[d.id] ?? []} onChange={(ps) => setParts((x) => ({ ...x, [d.id]: ps }))} onView={(pg) => { setDocIdx(i); setFocus({ page: pg, box: null, label: `Page ${pg}`, n: Date.now() }); }} disabled={handled} />
                    </div>
                  );
                })}
              </div>
            </section>

            {!handled && (
              <section className="card p-5">
                <textarea className="input h-16 resize-none py-2" placeholder="Optional note for the account (saved with the intake note)…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                {isDupError && (
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <input type="checkbox" className="mt-0.5" checked={notDup} onChange={(e) => setNotDup(e.target.checked)} />
                    I checked: this is a different person, not the existing patient. Create a new account anyway.
                  </label>
                )}
                <div className="mt-3"><ErrorBox error={complete.error} /></div>
                {missingRequired.length > 0 && <div className="mt-2 text-xs text-red-600">Still needed: {missingRequired.join(", ")}</div>}
                {!allVerified && <div className="mt-2 text-xs text-amber-700">Some files aren't verified yet. You can still file them; they'll show as “needs check” on the patient's checklist.</div>}
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn btn-ghost" onClick={() => setRejecting(true)}><XCircle size={15} /> Not patient paperwork</button>
                  <button className="btn btn-primary ml-auto" disabled={!canFile || complete.isPending} onClick={() => complete.mutate()}>
                    {decision === "new" ? <><UserPlus size={15} /> Create patient & file</> : <><UserCheck size={15} /> File to this patient</>}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {rejecting && (
        <Modal title="Set this paperwork aside" subtitle="It stays in the Filed list. Nothing is deleted." onClose={() => setRejecting(false)}>
          <input className="input" autoFocus placeholder="Why? (e.g. junk fax, wrong client, duplicate)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2"><ErrorBox error={reject.error} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={reason.trim().length < 3} onClick={() => reject.mutate()}>Set aside</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

App-specific pieces you'll replace: `useNav` (tabs/navigation), `useSession`, `get/post/uploadFiles`
(fetch wrappers), `Page`, `Badge`, `Modal`, `Select`, `ErrorBox`, `PAYER_TYPES`, `isoToDisplay`, and the
Tailwind color names `navy-*` / `accent-*` (the app's own theme colors).

### 2.11 Tests to copy

Every one of these runs with the AI switched off (`CALIBER_AI_READER=off` in the Vitest env), using the
demo reader and generated fake PDFs:

```ts
// Splitting a packet into separate documents, and choosing where each insurance / claim goes for an existing patient.
import { setup, login } from "./helpers";
import { makePdf } from "../server/lib/demoPaperwork";
import { pdfPageCount } from "../server/lib/pdfPages";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const packet = (pages: number) => makePdf(Array.from({ length: pages }, (_, i) => [{ x: 50, y: 700, size: 12, text: `Fake packet page ${i + 1} ${Math.random()}` }]));

async function uploadPacket(agent: Awaited<ReturnType<typeof login>>, pages: number) {
  const up = await agent.post("/api/intake").field("source", "fax").attach("files", packet(pages), { filename: "packet.pdf", contentType: "application/pdf" }).expect(201);
  // The reader runs in the background; wait until the item is ready for review.
  for (let i = 0; i < 50; i++) {
    const d = (await agent.get(`/api/intake/${up.body.id}`).expect(200)).body;
    if (d.status === "review") return d;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("reader never finished");
}

const newPatient = (last: string) => ({ lastName: last, firstName: "PACKET", dob: "1990-01-01", sex: "F", coverageType: "WC", insurances: [] });

describe("splitting a packet into documents", () => {
  it("files each part as its own document and keeps set-aside pages off the patient's file", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 5);
    const doc = item.documents[0];
    expect(doc.pageCount).toBe(5);
    const r = await biller
      .post(`/api/intake/${item.id}/complete`)
      .send({
        decision: "new",
        patient: newPatient("TEST-SPLIT"),
        documents: [{ id: doc.id, docType: "other", verified: false, sections: [
          { fromPage: 1, toPage: 1, docType: "other", verified: false, skip: true }, // fax cover
          { fromPage: 2, toPage: 3, docType: "rx", verified: true },
          { fromPage: 4, toPage: 4, docType: "other", verified: false, skip: true }, // someone else's page
          { fromPage: 5, toPage: 5, docType: "delivery_ticket", verified: false },
        ] }],
      })
      .expect(200);
    expect(r.body).toMatchObject({ filed: 2, setAside: 2 });

    const docs = (await biller.get(`/api/patients/${r.body.patientId}/documents`).expect(200)).body;
    expect(docs.documents.map((d: { docType: string }) => d.docType).sort()).toEqual(["delivery_ticket", "rx"]);
    const rx = docs.documents.find((d: { docType: string }) => d.docType === "rx");
    expect(rx).toMatchObject({ pageFrom: 2, pageTo: 3, pageCount: 2, parentDocumentId: doc.id });
    expect(rx.verifiedAt).toBeTruthy();
    const file = await biller.get(`/api/documents/${rx.id}/file`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); }).expect(200);
    expect(await pdfPageCount(file.body as Buffer)).toBe(2);
    expect(docs.checklist.items.find((i: { docType: string }) => i.docType === "rx").status).toBe("verified");

    // The whole packet stays with the inbox item, marked as the packet, and is not on the patient's file.
    const after = (await biller.get(`/api/intake/${item.id}`).expect(200)).body;
    expect(after.documents.find((d: { id: number }) => d.id === doc.id)).toMatchObject({ docType: "packet", patientId: null });
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].body).toMatch(/Set aside.*page 1.*page 4/);
  });

  it("refuses parts that overlap or go past the last page", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 3);
    const send = (sections: object[]) => biller.post(`/api/intake/${item.id}/complete`).send({ decision: "new", patient: newPatient("TEST-BADSPLIT"), documents: [{ id: item.documents[0].id, docType: "other", verified: false, sections }] });
    await send([{ fromPage: 1, toPage: 2, docType: "rx", verified: false }, { fromPage: 2, toPage: 3, docType: "po", verified: false }]).expect(400);
    await send([{ fromPage: 1, toPage: 4, docType: "rx", verified: false }]).expect(400);
    await send([{ fromPage: 3, toPage: 1, docType: "rx", verified: false }]).expect(400);
    // Nothing was filed.
    expect((await biller.get(`/api/intake/${item.id}`).expect(200)).body.status).toBe("review");
  });

  it("can't file another client's packet", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const item = await uploadPacket(owner, 2);
    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    await owner
      .post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-XCLIENT"), documents: [{ id: item.documents[0].id, docType: "rx", verified: false, sections: [{ fromPage: 1, toPage: 2, docType: "rx", verified: false }] }] })
      .expect((res) => expect([400, 404, 409]).toContain(res.status));
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    expect((await owner.get(`/api/intake/${item.id}`).expect(200)).body.status).toBe("review");
  });
});

describe("finding a patient by name", () => {
  it("matches the last name, the first name, or 'first last'", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    for (const q of ["TEST-SCORE", "PATIENT ONE", "PATIENT ONE TEST-SCORE", "TEST-SCORE, PATIENT"]) {
      const found = (await biller.get(`/api/patients?q=${encodeURIComponent(q)}`).expect(200)).body as { firstName: string }[];
      expect(found.some((p) => p.firstName === "PATIENT ONE")).toBe(true);
    }
  });
});

describe("insurance slots when filing to an existing patient", () => {
  async function fileTo(agent: Awaited<ReturnType<typeof login>>, patientId: number, patient: object, replaceRanks: number[] = []) {
    const item = await uploadPacket(agent, 1);
    await agent.post(`/api/intake/${item.id}/complete`).send({ decision: "existing", patientId, patient, replaceRanks, documents: [{ id: item.documents[0].id, docType: "other", verified: false }] }).expect(200);
    return (await agent.get(`/api/patients/${patientId}`).expect(200)).body as { lastName: string; insurances: { rank: number; claimNumber: string | null; adjusterName: string | null; authorizationNumber: string | null }[] };
  }

  it("adds a second claim without touching the first, and without changing the patient's details", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const before = (await biller.get("/api/patients/1").expect(200)).body;
    const claim1 = before.insurances.find((i: { rank: number }) => i.rank === 1);
    const after = await fileTo(biller, 1, { lastName: "SHOULD-NOT-CHANGE", insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER" }] });
    expect(after.lastName).toBe(before.lastName); // applyUpdates was off
    expect(after.insurances.find((i) => i.rank === 1)).toMatchObject({ claimNumber: claim1.claimNumber, adjusterName: claim1.adjusterName });
    expect(after.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER" });
  });

  it("updating a slot keeps what's on file; replacing a slot starts it fresh", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const updated = await fileTo(biller, 1, { insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", authorizationNumber: "TEST-NEW-AUTH" }] });
    expect(updated.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER", authorizationNumber: "TEST-NEW-AUTH" });
    const replaced = await fileTo(biller, 1, { insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-OTHER-CLAIM" }] }, [2]);
    expect(replaced.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-OTHER-CLAIM", adjusterName: null, authorizationNumber: null });
  });
});

describe("checking what the AI read", () => {
  it("the demo reader says where on the page each value came from", async () => {
    const { demoPacket, demoExtraction } = await import("../server/lib/demoPaperwork");
    const { sha256 } = await import("../server/lib/fileStore");
    const p = demoPacket("new", "TEST");
    const e = demoExtraction([sha256(p.pdf)])!;
    const last = e.patient.lastName;
    expect(last.value).toBeTruthy();
    expect(last.where).toMatchObject({ file: 0 });
    expect(last.where!.page).toBeGreaterThanOrEqual(1);
    const b = last.where!.box!;
    for (const v of [b.x, b.y, b.w, b.h]) expect(v >= 0 && v <= 1).toBe(true);
  });

  it("stores how each AI field ended up and notes the counts (not the values) on the account", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 1);
    const fieldReview = [
      { field: "lastName", label: "Last name", aiValue: "TEST-REVIEW", finalValue: "TEST-REVIEW", confidence: "high", outcome: "checked" },
      { field: "firstName", label: "First name", aiValue: "PACKIT", finalValue: "PACKET", confidence: "low", outcome: "edited" },
      { field: "phone", label: "Phone", aiValue: "5550000001", finalValue: "5550000001", confidence: "medium", outcome: "ai" },
    ];
    const r = await biller.post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-REVIEW"), documents: [{ id: item.documents[0].id, docType: "other", verified: false }], fieldReview })
      .expect(200);
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].body).toContain("AI read 3 fields: 1 checked as right, 1 corrected, 1 not checked.");
    expect(notes[0].body).not.toContain("PACKIT");
    const { getTenant } = await import("../server/db/tenantDb");
    const tenant = (await getTenant(ctx.score, "score-demo")).db;
    const { intakeItems } = await import("../shared/schema/tenant");
    const { eq } = await import("drizzle-orm");
    const [row] = await tenant.select().from(intakeItems).where(eq(intakeItems.id, item.id));
    expect(row.fieldReview).toEqual(fieldReview);
  });

  it("rejects a review with an unknown outcome", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 1);
    await biller.post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-BADREVIEW"), documents: [{ id: item.documents[0].id, docType: "other", verified: false }], fieldReview: [{ field: "x", label: "X", aiValue: null, finalValue: null, confidence: "high", outcome: "guessed" }] })
      .expect(400);
  });
});
```

```ts
// Intake (paperwork in → read → match → file) and documents, including client separation.
import { setup, login } from "./helpers";
import { makePdf } from "../server/lib/demoPaperwork";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const pdf = () => makePdf([[{ x: 50, y: 700, size: 12, text: `Fake test page ${Math.random()}` }]]);

async function openItems(agent: Awaited<ReturnType<typeof login>>) {
  return (await agent.get("/api/intake").expect(200)).body as { id: number; source: string; status: string; foundName: string | null }[];
}

describe("intake inbox", () => {
  it("starts with demo paperwork that the demo reader has read", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const items = await openItems(biller);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const fax = items.find((i) => i.source === "fax")!;
    const detail = (await biller.get(`/api/intake/${fax.id}`).expect(200)).body;
    expect(detail.reader).toBe("demo");
    expect(detail.extraction.patient.lastName.value).toBe("SAMPLE");
    expect(detail.documents[0].docType).toBe("rx");
  });

  it("files a new patient from paperwork, with the documents typed and verified", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const fax = (await openItems(biller)).find((i) => i.source === "fax")!;
    const detail = (await biller.get(`/api/intake/${fax.id}`).expect(200)).body;
    expect(detail.matches.filter((m: { score: number }) => m.score >= 80)).toHaveLength(0);
    const r = await biller
      .post(`/api/intake/${fax.id}/complete`)
      .send({
        decision: "new",
        patient: { lastName: "SAMPLE", firstName: "MARIA", dob: "1979-04-22", sex: "F", coverageType: "WC", insurances: [{ rank: 1, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-WC-7781" }] },
        documents: [{ id: detail.documents[0].id, docType: "rx", verified: true }],
      })
      .expect(200);
    const docs = (await biller.get(`/api/patients/${r.body.patientId}/documents`).expect(200)).body;
    expect(docs.documents).toHaveLength(1);
    const rx = docs.checklist.items.find((i: { docType: string }) => i.docType === "rx");
    expect(rx.status).toBe("verified");
    expect(docs.checklist.items.find((i: { docType: string }) => i.docType === "delivery_ticket").status).toBe("missing");
    // Done items leave the open inbox, and can't be filed twice.
    expect((await openItems(biller)).some((i) => i.id === fax.id)).toBe(false);
    await biller.post(`/api/intake/${fax.id}/complete`).send({ decision: "new", documents: [{ id: detail.documents[0].id, docType: "rx", verified: true }] }).expect(409);
    const file = await biller.get(`/api/documents/${detail.documents[0].id}/file`).expect(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe("%PDF-");
    // The viewer frames it, but only our own pages may.
    expect(file.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(file.headers["content-security-policy"]).toContain("frame-ancestors 'self'");
  });

  it("spots an existing patient and refuses to create a duplicate by accident", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const email = (await openItems(biller)).find((i) => i.source === "email")!;
    const detail = (await biller.get(`/api/intake/${email.id}`).expect(200)).body;
    expect(detail.matches[0].score).toBeGreaterThanOrEqual(80);
    expect(detail.matches[0].lastName).toBe("TEST-SCORE");
    const dup = { lastName: "TEST-SCORE", firstName: "PATIENT ONE", dob: "1980-01-01", sex: "M", coverageType: "WC", insurances: [] };
    await biller.post(`/api/intake/${email.id}/complete`).send({ decision: "new", patient: dup, documents: [{ id: detail.documents[0].id, docType: "delivery_ticket", verified: true }] }).expect(409);
    const r = await biller
      .post(`/api/intake/${email.id}/complete`)
      .send({ decision: "existing", patientId: detail.matches[0].patientId, documents: [{ id: detail.documents[0].id, docType: "delivery_ticket", verified: true }] })
      .expect(200);
    expect(r.body.patientId).toBe(detail.matches[0].patientId);
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].category).toBe("intake");
  });

  it("keeps each client's inbox and documents separate", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.pacific);
    const before = (await openItems(owner)).length;
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    const up = await owner.post("/api/intake").field("source", "upload").field("sender", "test").attach("files", pdf(), { filename: "a.pdf", contentType: "application/pdf" }).expect(201);
    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    expect((await openItems(owner)).length).toBe(before);
    const other = await owner.get(`/api/intake/${up.body.id}`);
    if (other.status === 200) expect(other.body.sender).not.toBe("test");
    else expect(other.status).toBe(404);
  });

  it("rejects file types that aren't documents", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    await owner.post("/api/intake").attach("files", Buffer.from("echo hi"), { filename: "x.sh", contentType: "application/x-sh" }).expect(400);
  });

  it("only people with intake permission can use the inbox", async () => {
    const poster = await login(ctx.app, "poster@caliber.test", ctx.score);
    await poster.get("/api/intake").expect(403);
  });
});

describe("notes, follow-ups and templates", () => {
  it("a note with a follow-up date lands on the Call List", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller.post("/api/patients/1/notes").send({ body: "Call adjuster back", category: "call", followUpDate: "2026-01-02" }).expect(201);
    const tasks = (await biller.get("/api/tasks").expect(200)).body;
    expect(tasks.some((t: { title: string; overdue: boolean }) => t.title === "Call adjuster back" && t.overdue)).toBe(true);
    await biller.post("/api/patients/1/notes").send({ body: "x", category: "not-a-category" }).expect(400);
    const templates = (await biller.get("/api/note-templates").expect(200)).body;
    expect(templates.length).toBeGreaterThan(0);
  });

  it("the overview pulls everything for a patient into one response", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const o = (await biller.get("/api/patients/1/overview").expect(200)).body;
    expect(o.patient.insurances.length).toBeGreaterThan(0);
    expect(o.timeline.length).toBeGreaterThan(0);
    expect(o.checklist.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(o)).not.toMatch(/ssnEncrypted|memberIdEncrypted|storageKey/);
  });
});
```

```ts
import { afterEach, describe, expect, it } from "vitest";
import { aiReaderStatus } from "../server/lib/reader";

const saved = { ...process.env };
const set = (env: Record<string, string | undefined>) => {
  for (const k of ["CALIBER_AI_READER", "ANTHROPIC_API_KEY", "CALIBER_AI_BAA_CONFIRMED", "NODE_ENV"]) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
};

describe("AI reader on/off", () => {
  afterEach(() => { process.env = { ...saved }; });

  it("is on in the local demo when a key is set", () => {
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "development" });
    expect(aiReaderStatus().on).toBe(true);
  });

  it("can be paused with CALIBER_AI_READER=off", () => {
    set({ ANTHROPIC_API_KEY: "test-key", CALIBER_AI_READER: "off" });
    expect(aiReaderStatus().on).toBe(false);
  });

  it("is off without a key", () => {
    set({ NODE_ENV: "development" });
    expect(aiReaderStatus().on).toBe(false);
  });

  it("never runs on real patient data (production) until the BAA is confirmed", () => {
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "production" });
    expect(aiReaderStatus().on).toBe(false);
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "production", CALIBER_AI_BAA_CONFIRMED: "yes" });
    expect(aiReaderStatus().on).toBe(true);
  });
});
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

