# Architecture

## The big picture

```
Browser (React screens)
   │  HTTPS, session cookie (15-min idle timeout)
   ▼
Express server ── checks login ── checks permission ── picks the client FROM THE SESSION
   │                                                         │
   ▼                                                         ▼
Control database (NO patient data)               One database PER CLIENT (patient data)
 clients, users, roles, assignments,              patients, insurance, claim data, service lines,
 login audit, payers, HCPCS / ICD-10 /            ledger (append-only), notes (append-only),
 modifier code sets                               alerts, closed periods, audit log (append-only)
                                                  + the client's own encryption key
```

## How client separation is enforced

1. **One database per client.** Locally each client is its own folder under
   `data/clients/<slug>/`. In production each will be its own PostgreSQL
   database.
2. **One door.** `server/db/tenantDb.ts` is the only code that opens a client
   database. A test fails if any other file tries.
3. **The client comes from the session.** `requireClient` in
   `server/middleware.ts` reads `activeClientId` from the logged-in session and
   re-checks the user's assignment on every request. Client IDs in the URL, body
   or headers are ignored, and unknown body fields are rejected.
4. **A separate key per client** for SSNs and member IDs (AES-256-GCM). Data
   encrypted with one client's key can't be read with another's.
5. **The screens forget everything** when you switch clients.
6. **Tests** in `tests/tenant-isolation.test.ts` try to read across clients and
   must fail.

## Ledger rules (CLAUDE.md 3.3)

- Money is whole cents everywhere (`shared/money.ts`).
- Each ledger row records how it changes what insurance owes
  (`insurance_delta_cents`) and what the patient owes (`patient_delta_cents`).
  Every balance is the sum of the rows.
- Database triggers (`migrations/tenant/0001_append_only_guards.sql`) block any
  UPDATE or DELETE on the ledger, notes and audit log, and block posting into a
  closed period. That holds even if the app code has a bug.
- Mistakes are fixed with a **reversal**: a new entry, equal and opposite, that
  points to the original.

## Folders

| Folder | What's in it |
|---|---|
| `client/` | The screens (React, Tailwind) |
| `server/` | API, login, permissions, client separation |
| `shared/` | Things both sides use: database schema, input rules, roles, pick lists, money and date helpers |
| `migrations/control`, `migrations/tenant` | Database changes, applied automatically at start to the control database and to **every** client database |
| `scripts/` | Code-set imports, demo reset |
| `tests/` | Automated checks |

## Local demo vs. production

The local demo uses an embedded PostgreSQL (PGlite) so nothing has to be
installed. Before real patient data can go in, these are **required**:

| Item | Local demo now | Required for production |
|---|---|---|
| Hosting | Your computer | DigitalOcean / Supabase products covered by Caliber's signed BAA (Q-030) |
| Databases | PGlite folders | Managed PostgreSQL, one database per client, encrypted at rest |
| Encryption keys | Key files in `data/keys/` | Provider secret storage / key management, one key per client |
| Sessions | In memory | Stored in the control database; `SESSION_SECRET` from secret storage |
| Multi-factor login | **Not built yet** | Required for all staff and client admins (CLAUDE.md 3.2, Q-058) |
| Document files | Encrypted files in `data/clients/<slug>/files/` | The client's own BAA-covered storage bucket, encrypted with the client's key |
| AI reader | Off (demo reader or typing by hand) | Only after Caliber's BAA with Anthropic is signed (Q-054) |
| HTTPS | Not needed on localhost | Required |
| Code sets | Official files bundled in `codesets/official/` load on first start | Same, plus Settings → Codes → "Check CMS/CDC for updates" each quarter |
| Backups | None | Per-client, encrypted, tested restores |

## Code sets (HCPCS, modifiers, ICD-10-CM)

- The official files ship in `codesets/official/`, byte-for-byte as published (CMS quarterly HCPCS file;
  CDC/NCHS ICD-10-CM code descriptions). `manifest.json` lists each file's source URL and SHA-256.
- `server/lib/codesets.ts` reads them using the record layouts published with them, and loads them once at
  start-up. Every load is recorded in `code_set_loads` (file, URL, fingerprint, when, by whom, how many codes
  were added / changed / retired).
- Nothing is deleted. HCPCS codes carry CMS's added and termination dates. ICD-10-CM is versioned by fiscal
  year: a changed code gets a new row from October 1 and the old row an end date; a retired code gets an end
  date. Category "headers" are kept for search but marked not billable.
- Charge entry checks every HCPCS code, modifier and ICD-10-CM code against the date of service. Code search
  only offers codes valid on that date.
- Updates: Settings → Codes → "Check CMS/CDC for updates" (or `npm run codes:update` with the app stopped)
  downloads anything newer from cms.gov and ftp.cdc.gov and loads it the same way.
- CPT is not loaded (AMA license). The CMS file used contains no CPT codes.

## Paperwork in: the Inbox

```
fax / email gateway ─┐
client portal upload ├─► Inbox item ─► reader (demo, AI, or none) ─► person reviews ─► filed to a NEW or EXISTING patient
patient portal upload┤     (files encrypted                 suggests fields with          checks every value, picks the match,
staff upload / scan ─┘      with the client's key)          a "how sure" level            sets each document's type and verifies it
```

- Files are encrypted with the client's own key before they are written
  (`server/lib/fileStore.ts`). Every view of a file is in the audit log.
- `server/lib/reader.ts` picks the reader. The AI reader (Claude) only runs when
  the BAA settings are turned on. It returns values with a confidence level; the
  review screen colors anything it wasn't sure about. Nothing is saved until a
  person files it.
- `server/lib/match.ts` looks for an existing patient **inside that one client
  only** (date of birth, name, SSN last 4, phone, claim number, member ID).
  A strong match must be explicitly dismissed before a new patient is created.
- **Packets are split into parts.** A fax is usually one PDF holding many documents. The reader suggests
  page ranges (Rx, delivery ticket, RFA...) and flags pages that are cover sheets or about someone else;
  the reviewer adjusts them. On filing, each part is cut into its own PDF (`server/lib/pdfPages.ts`,
  pdf-lib, runs on our server) and filed to the patient. The full packet stays with the Inbox item, never
  on the patient's file, so a misfiled page about someone else can't end up in this patient's documents.
- **Parts run first page to last page.** The reader is asked to group pages into whole documents
  (a 4-page RFA is one part, not four). The review screen joins neighboring pages of the same type into
  one part, shows a colored page map, and lets the reviewer split, join, retype or set aside a part.
- **Where each value came from.** Every field the AI fills carries `where` (file, page, and an
  approximate box on the page, as fractions of the page size). On the review screen AI-filled boxes have
  a purple outline; clicking one scrolls the document (drawn in the browser by pdf.js, `PageViewer.tsx`)
  to that page and highlights the spot. Enter or the check button marks it as matching the paper (green);
  changing it turns it amber and keeps "AI read: …" under the box. The box is the AI's estimate, so it can
  be a little off. On filing, each field's outcome (checked, corrected, not checked) is stored on the Inbox
  item (`intake_items.field_review`) and the account note gets the counts only, so we can measure the AI's
  accuracy over time.
- **Existing patients and insurance slots.** When paperwork is filed to an existing patient, each
  insurance read from it goes where the reviewer chooses: a new claim in an empty slot, an update to a
  claim on file (new values laid over old), a full replacement, or not saved.
- Each patient's **ready-to-bill checklist** compares the verified documents on
  file with Settings → Required documents for the patient's payer types.

## Many patients at once, kept current

- Patients open as tabs across the top. Each one stays loaded and remembers
  which section it was on, so switching is instant. Two can be shown side by
  side.
- `GET /api/events` is a live feed (Server-Sent Events) for the current client.
  It carries only a kind and a record ID, never patient details. When a
  teammate adds a note or posts money, everyone's open screens for that patient
  refresh by themselves.

## Users, View as and portals

- Three kinds of login: Caliber staff, client portal, patient portal. Each gets
  its own app; portal users are locked to their one client (and the patient
  portal to one patient) on the server.
- **View as** lets an owner or manager see exactly what another user sees. The
  server blocks every change while it's on, and the audit log records
  "REAL as TARGET".
- New users and password resets get a temporary password that must be changed
  before anything else works.

## Phase plan

- **Phase 1 (done):** login, roles, client separation, Patient Entry, Ledger,
  Charge Entry, Payment Posting (bulk), notes, alerts, reversals, close books,
  audit log.
- **Phase 2 (done in this round):** patient Overview, many open patients and
  side-by-side, note templates and follow-ups, Call List, live updates,
  Inbox with document scanning/verification and new-vs-existing matching,
  AI reader (off until BAA), reports with CSV, Users & access with View as,
  Settings, client portal, patient portal, inbound paperwork API.
- **Next:** CMS-1500 paper claims, 837P electronic claims (test mode), claim
  status on the ledger, line-item payment posting, statements, MFA.
- **Then:** Rules library with sources, rules check on charges and claims,
  Work Comp RFA and Second Bill Review, VA payer rules.
- **Then:** CENCOM order API, clearinghouse connections, 835 payments,
  277/999 status, eligibility.
