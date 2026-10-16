# Caliber DME Billing: Instructions for Claude

Read this whole file at the start of every session. These rules apply to every
change, big or small. If a request conflicts with a rule marked **NEVER** or
**ALWAYS**, stop and ask Robert before doing anything.

---

## 1. Who you're working with and how to talk

- **Robert** is the decision maker. He is CEO of SCORE Ortho and a consultant for
  Caliber DME Billing (the owner of this software). His word is final.
- **Use simple, everyday language.** No jargon without a one-line plain
  explanation. Short answers first, details after.
- When you finish something, say in plain words: what changed, how you checked
  it, and anything still unsure.
- **Billing rules you're unsure about:** make your best guess, build it, flag it
  clearly, and add the question to `docs/OPEN_QUESTIONS.md` (see section 9).
  Don't stop work to wait for the answer unless the guess could break separation
  between clients, expose patient data, or send a claim to a payer.

---

## 2. What we're building

A web-based DME (durable medical equipment) billing system for **Caliber DME
Billing**. Caliber bills on behalf of about 12 DME distributor clients. SCORE
Ortho is one of them.

Main parts:

1. **Billing workspace** for Caliber's team: patient setup, charge entry, patient
   ledger, payment posting, call list, claims (electronic and paper), statements,
   Work Comp authorization (RFA/RFS), electronic claims and remittance, data
   tables and reports. The detailed field-by-field spec is in the spreadsheet
   (section 8).
2. **Client portal**: each client logs in and sees only their own dashboard,
   patients, billing status and custom reports.
3. **Patient portal**: planned for later. Design so it can be added without
   rework, but don't build it until asked.
4. **Rules library and rules check**: shows the exact payer, state and federal
   rules that apply to each order, with the source, and whether the order meets
   them.
5. **Inbound API**: lets client systems (starting with SCORE's CENCOM) send
   orders in automatically once they're ready to bill.

Payers, in order of priority:
1. **Workers' Compensation**, all 50 states plus DC
2. **VA**, both billed directly to the VA and through Community Care Network
   (CCN) third-party administrators
3. Later: Medicare (DME MACs), Medicaid, commercial insurance. Design the payer
   model so these plug in without rework.

Devices: **all DME types**, not just SCORE's products. Never hard-code a product
list.

---

## 3. NEVER / ALWAYS rules (non-negotiable)

### 3.1 Client data separation (the #1 rule)

Each client's data, including all patient health information (PHI), lives in
**its own separate database**. Data from one client must **NEVER** be readable,
writable, joinable or mixable with another client's data, through any path:
code, reports, exports, logs, caches, files, background jobs, AI calls, or
backups.

- **ALWAYS** decide which client a request belongs to **on the server, from the
  logged-in user's session or the API key**. **NEVER** decide it from a URL,
  query string, form field, header or anything else the browser sends.
- **ALWAYS** get a database connection through the single tenant-connection
  helper (one place in the code). **NEVER** create a database connection anywhere
  else.
- **NEVER** write a query, report or job that spans more than one client
  database. If Caliber needs totals across clients, compute them one client at a
  time, keep only non-PHI numbers (counts and dollar totals), and store them in
  the control database. Ask Robert first.
- Each client gets **its own file storage bucket** and **its own encryption
  key**.
- Caches, queues and background jobs **ALWAYS** carry the client ID and
  **NEVER** share keys or entries between clients.
- The **control database** holds only: clients, users, roles, permissions,
  API keys (hashed), connection settings and audit of logins. It holds
  **NO PHI**.
- **ALWAYS** add or update automated "cross-client" tests for any new endpoint,
  report, export or job. The test logs in as Client A and tries to reach Client
  B's data, and must fail. A change without this test isn't done.
- Caliber staff can work for many clients but see **one client at a time** (a
  client switcher that reconnects to that client's database). Staff can only
  switch to clients they're assigned to.

### 3.2 Patient data (PHI) and HIPAA

- **NEVER** put real patient data in code, tests, seed files, fixtures,
  screenshots, commit messages, GitHub issues or chat. Use obviously fake
  synthetic data only (e.g. "TEST, PATIENT ONE", SSN `000-00-0001`).
- **NEVER** write PHI to application logs or error trackers. Log record IDs, not
  names, DOBs, SSNs, member IDs, diagnosis codes or addresses.
- **NEVER** send PHI to any outside service unless Caliber has a signed BAA
  with that vendor. Approved vendors are listed in `docs/VENDORS_AND_BAAS.md`.
  If a vendor isn't on the list, don't use it. Ask.
- SSNs, member IDs and bank details are **encrypted at the field level**, shown
  masked by default (last 4), and fully revealed only with permission. Every
  reveal is logged.
- **ALWAYS** record an audit entry for every view, create, change, delete,
  export and print of patient data: who, when, which client, which record, what
  action. Audit records can't be edited or deleted.
- Encrypt everything in transit (HTTPS/TLS) and at rest.
- Sessions time out after inactivity (default 15 minutes, flag for review).
  Multi-factor login is required for all Caliber staff and client-portal admins.
- Follow "minimum necessary": each screen and API returns only the fields that
  role needs.

### 3.3 Money and the ledger

- Store money as **whole cents (integers)**. **NEVER** use floating-point
  numbers for money.
- Ledger entries (charges, payments, adjustments, write-offs, refunds) are
  **never edited or deleted** after posting. Fix mistakes with a reversing or
  adjusting entry that points to the original.
- **Books closed:** once a period is closed, nothing dated in that period can be
  changed. Corrections post in the current open period. (The spreadsheet marks
  service dates and deposit dates as "NO ONCE BOOKS CLOSED".)
- Every balance shown on screen must be computable from the ledger entries.
  Don't keep separate running totals that can drift.
- **Account notes can never be edited or deleted** (from the spec). Staff must
  note every action on an account. Alerts are different: they're entered by
  hand and can be removed.
- **Only management can remove** a patient or account (from the spec).
- Every charge and payment shows date entered, entered by, date modified and
  modified by.

### 3.4 Billing rules, codes and citations

- **NEVER make up** a billing rule, code, modifier, fee amount, form field, law
  or citation. If you don't have a real source, say so and flag it.
- Every rule in the rules library **ALWAYS** has: source name, link or document
  reference, exact quoted text, jurisdiction (state/federal/payer), payer type,
  effective date, end date (if any), date last verified, and who verified it.
- The software shows a rule to users **only** if it has a stored source. AI may
  help write a plain-English summary, but the summary must sit next to the
  quoted source text and be labeled as a summary.
- Rules are **versioned by date**. An order is checked against the rules in
  effect on its date of service, not today's rules.

### 3.5 Claims going out the door

- **NEVER** send a real claim, eligibility check or any other transaction to a
  payer or clearinghouse from development or test environments. Use the
  clearinghouse test/sandbox mode only.
- Electronic and paper claims are built from the **same claim record**. Paper
  output must match what would have gone electronically.

### 3.6 Secrets and repo hygiene

- **NEVER** commit passwords, API keys, database URLs, encryption keys or
  `.env` files. Use the hosting provider's secret storage.
- **NEVER** use SCORE's CENCOM repository for this project. This is a separate
  codebase owned by Caliber.

---

## 4. Hosting and architecture

### Hosting
- Host on **DigitalOcean and/or Supabase**, using **only the products covered by
  Caliber's signed BAA** with that provider. Not every product a provider offers
  is HIPAA-eligible. Check `docs/VENDORS_AND_BAAS.md` before using any new
  service.
- No AWS (Robert's preference).

### Separate databases per client
- **Control database** (no PHI): clients, users, roles, permissions, client
  assignments, API keys, rules library, code sets (HCPCS, ICD-10, modifiers),
  payer directory.
- **One client database per DME client** (PHI): patients, insurance, orders,
  documents, charges, claims, payments, ledger, notes, call list, audit log.
- All client databases share **one schema**. Migrations run against the control
  database and then **every** client database. A migration isn't done until it
  has run on all of them. Track the version per database.
- New client setup is a scripted, repeatable process: create database, create
  storage bucket, create encryption key, run migrations, register in control
  database.

### Suggested tech stack
This matches what Robert already knows from CENCOM, to keep things familiar.
Propose changes, don't just make them.

- **TypeScript everywhere**, strict mode
- **Frontend:** React, Vite, Tailwind, shadcn/ui, TanStack Query, React Hook Form
  with Zod
- **Backend:** Node.js with Express (or similar), Zod validation on every input
- **Database:** PostgreSQL with Drizzle ORM
- **Tests:** Vitest for unit and integration tests, Playwright for screen tests

### Inbound API (CENCOM and other client systems)
- Each client gets its own API keys. **The API key decides which client the
  data goes to.** Nothing in the request body can override that.
- Requests are signed (HMAC) and use an idempotency key so the same order sent
  twice isn't created twice.
- An order is accepted as **"ready to bill"** only when the required items for
  that payer and device are present. Otherwise it's accepted as "incomplete"
  with a clear list of what's missing. Typical items:
  - Signed prescription / order (Rx)
  - Delivery ticket / proof of delivery
  - Purchase order (PO)
  - Request for Authorization (RFA) / Request for Service (RFS) and the
    approval or authorization number
  - Chart notes / medical records supporting medical need
  - Patient demographics and insurance info
  - Claim number, date of injury, employer and adjuster (Work Comp)
  - VA referral / authorization number (VA and CCN)
  - Diagnosis codes (ICD-10) and HCPCS codes with modifiers
  - Any other payer-specific required documents from the rules library
- The required-documents checklist comes from the rules library (per payer type,
  state and HCPCS code), not hard-coded lists.
- Publish the API with an OpenAPI spec in `docs/api/`.

---

## 5. Users and permissions

Three separate kinds of user. They never share login screens or permissions.

1. **Caliber staff**: work inside assigned client(s)
2. **Client portal users**: belong to exactly one client and see only that client
3. **Patient portal users** (later): see only their own records

Starting Caliber staff roles (flag for Caliber to confirm):
- Owner / Super Admin
- Billing Manager
- Biller (patient entry, charge entry, claims)
- Payment Poster
- Collections / AR follow-up
- Read-only / Auditor

Starting client portal roles (flag for Caliber to confirm):
- Client Admin (manages their own users)
- Client User (view dashboard, patients, billing status, run reports)

Rules:
- **Deny by default.** A user can only do what their role explicitly allows.
- Permissions are checked **on the server** for every request. Hiding a button
  is not security.
- Permissions are fine-grained (e.g. `patient.view`, `patient.edit`,
  `ssn.reveal`, `charge.post`, `payment.post`, `claim.submit`,
  `period.close`, `report.export`) so roles can be adjusted without code
  changes.

---

## 6. Billing domain rules

### Code sets
- **HCPCS Level II**: required on every DME line. Updated **quarterly** by CMS.
  Store every code with effective and end dates. Never delete old codes, because
  old claims need them.
- **ICD-10-CM** diagnosis codes: updated every **October 1** (sometimes also
  April). Same date-versioning.
- **Modifiers**: store as a code set with descriptions and dates. Support up to
  4 per line. Common DME ones include NU (new purchase), RR (rental), UE (used),
  LT/RT (left/right), KX (requirements met), and rental-month modifiers. Which
  modifiers a payer requires comes from the rules library, not hard-coding.
- **CPT**: **not now.** Caliber isn't licensed for CPT descriptions (an AMA
  license is required). Design the code tables so CPT can be added later.
  **NEVER** load or show CPT descriptions until Robert confirms a license.
- Code-set imports come from official public files (CMS for HCPCS and ICD-10)
  and record where and when each was loaded.

### Payer types
- **Workers' Comp** (all states): each state has its own fee schedule, forms,
  authorization rules, deadlines, and in many states electronic billing rules.
  Model it state by state. Every claim needs the WC claim number, date of
  injury, employer, carrier/TPA and adjuster. Generally the injured worker can't
  be billed (no patient balance billing). Flag any patient-statement logic for
  WC.
- **VA direct and VA Community Care Network (CCN)**: different submission routes
  and authorization/referral rules. Model as separate payer setups. Veterans
  generally can't be balance-billed. Flag any patient-statement logic.
- **Medicare / Medicaid / commercial** (later): DME MAC jurisdictions, coverage
  policies (LCDs and policy articles), capped rentals and so on. Build the payer
  model so these are configuration plus rules-library entries, not a rewrite.

### Claims and electronic transactions
- Electronic claims: **ANSI X12 837P (version 5010)**
- Paper claims: **CMS-1500 (02/12)**, printed onto the standard form layout
- Also plan for: **835** (remittance/payment files), **277CA / 999**
  (acknowledgments), **276/277** (claim status), **270/271** (eligibility),
  and attachments (PWK) for Work Comp
- **Support any clearinghouse.** Put clearinghouse-specific code behind one
  common interface so new clearinghouses can be added without touching billing
  logic.
- Claim status should update automatically (near real-time) from clearinghouse
  responses and 835/277 files, and show on the ledger and client portal.

### Rules library and rules check
- Store rules as data (see 3.4), searchable by payer type, state, HCPCS code,
  modifier and topic.
- For each order or claim, run a **rules check** that lists every rule that
  applies, whether it passes, fails or needs review, and the cited source.
- Show this on the charge-entry and claim screens before submission.
- Rule content must be loaded and verified by a person. Track who verified it
  and when. Show a warning for rules that haven't been checked in a set time
  (default 12 months, flag for review).

---

## 7. Screens and keyboard shortcuts

The billing team is used to a fast, keyboard-driven desktop billing system.
Keep that feel:
- The main screen is a clean home screen until a function is opened.
- Functions open as **tabs**, so several can be open at once.
- Keyboard shortcuts from the spec, including:
  - Patient Entry: **Ctrl+R**
  - Patient Ledger: **Ctrl+L**
  - Charge Entry: **Ctrl+K**
  - Payment Posting: **Ctrl+P**
  - Call List: **Ctrl+O**

  Note that browsers already use some of these (Ctrl+R reload, Ctrl+P print,
  Ctrl+L address bar, Ctrl+O open). The app must intercept them reliably or
  offer an alternative. This is flagged in the open questions.
- Field lengths, required fields, auto-fill, drop-downs, search (magnifying
  glass) and calendar pickers follow the spreadsheet.
- Smart input, e.g. a DOB typed as `010101` auto-formats to `01/01/01`, and age
  fills automatically from DOB.
- The patient ledger color-codes each type of entry, and the colors can be
  changed in settings. Defaults from the spec:
  - claim data: pink
  - charges: brown, turning yellow once on a claim
  - claim submission: white
  - payments: green
  - write-offs: red
  - patient share: blue
  - refunds: purple
  - adjustments: orange
- Subscriber details auto-fill once "Relationship to Insured" is chosen.
- Scanned documents (Rx, delivery tickets, POs, etc.) attach to the patient file,
  are searchable, and are kept permanently. Plan storage for that.
- Features marked UNUSED FEATURE in the screen spec are out of scope.

---

## 8. Source of truth for features

- **Spec spreadsheet:** "SOFTWARE SPECS - Caliber DME" (Google Sheets, ID
  `1od1tG2iBVhX_UG5NIzPkku7MY_viyuWHfWXaBVkGJmo`). Tabs: MAIN SCREEN, PT ENTRY,
  PT LEDGER, CHARGE ENTRY, PAYMENT POSTING, FILE MENU, PAT MENU, TRAN MENU, SCH
  MENU (unused), EHR MENU (unused), BILLS MENU, STATEMENTS, WORKCOMP, ELEC MENU,
  DATA MENU, DATA SCREENSHOTS, REPORTS.
- **`docs/spec/SCREEN_SPEC.md`** is the working version. It was built from 83
  screenshots of the sheet, tab by tab, with all patient and staff details
  removed. It lists the rows no screenshot showed. When the spreadsheet
  changes, update this file and note what changed.
- The team's current system is **Cal-Med "Practice Expert" (Version 2018)**,
  which sends claims through Office Ally. The screen spec describes its screens
  in detail. Match what the team relies on, and improve on it where our rules
  require (separate client databases, audit, permissions).
- **Never** save screenshots of the old system into the repo. They can show real
  patient data.
- Features marked "UNUSED" in the spec (Scheduling, EHR) are **out of scope**.
- Before building a screen, re-read its spec tab. If the spec is unclear, make a
  best guess and log a question.

---

## 9. Open questions log

- All unanswered questions live in **`docs/OPEN_QUESTIONS.md`**. It's written for
  Caliber's team, so use plain language.
- Each question has: an ID (Q-001…), topic, the question, why it matters,
  Claude's best guess (what's built right now), who should answer, status, and
  the answer once given.
- In code, mark every guessed billing rule with a comment:
  `// ASSUMPTION Q-0XX: <short description>` so it can be found and fixed once
  answered.
- When a question is answered, update the code, remove the ASSUMPTION marker,
  and move the question to "Answered" with the date.

---

## 10. Coding standards

- **Small, focused changes.** One feature or fix per branch and pull request.
- **Tests are required:**
  - Cross-client separation tests for every new endpoint, report, export or job
  - Unit tests for every billing calculation, rule and claim-file builder
  - Golden-file tests for 837P and CMS-1500 output (fake data)
  - Tests for permission checks (a user without the permission gets refused)
- Run type checks, lint and tests before saying something is done. Report the
  real results, including failures.
- Validate every input on the server with Zod, even if the screen also validates.
- Use dates without times for dates of service, DOB and deposit dates (no
  time-zone shifting). Use timestamps with time zone for audit events.
- Clear names that match billing terms (`dateOfService`, `hcpcsCode`,
  `allowedAmountCents`) and the glossary below.
- Database changes are made only through migrations, never by hand.
- No new outside library or service without saying why. For anything that
  touches PHI, check the BAA list first.
- Keep `docs/` current: architecture notes, API spec, vendor/BAA list, open
  questions.

### Git workflow
- Never push straight to `main`. Work on a branch, open a pull request, and
  summarize the change in plain language.
- Commit messages say what changed and why, in plain words. No PHI.

---

## 11. Glossary (plain language)

| Term | Meaning |
|---|---|
| DME | Durable medical equipment: braces, cold therapy units, etc. |
| PHI | Protected health information: anything that identifies a patient plus their health or billing info |
| BAA | Business Associate Agreement: the HIPAA contract required before a vendor can handle PHI |
| Tenant / client | One DME distributor that Caliber bills for (e.g. SCORE). Each has its own database |
| Control database | The shared database for logins, settings and code sets. No PHI |
| HCPCS | The codes that describe the equipment being billed (e.g. E0218) |
| ICD-10 | Diagnosis codes |
| Modifier | Two-character add-on to a HCPCS code (e.g. RR = rental, NU = new) |
| 837P | Electronic claim file format |
| CMS-1500 | Paper claim form |
| 835 / ERA | Electronic payment/remittance file from the payer |
| 277CA / 999 | Electronic "we received your claim" / "claim was rejected" responses |
| RFA / RFS | Request for Authorization / Request for Service (Work Comp approval) |
| CCN | VA Community Care Network: third-party administrators that handle VA community care |
| Fee schedule | The allowed price list for each code, set by state, payer or contract |
| Books closed | A finished accounting period that can no longer be changed |
| Ledger | The running list of every charge, payment and adjustment for a patient |
