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
| Multi-factor login | **Not built yet** | Required for all staff and client admins (CLAUDE.md 3.2) |
| HTTPS | Not needed on localhost | Required |
| Code sets | Small unverified starter list | Official CMS HCPCS and ICD-10 files loaded with `npm run import:hcpcs` / `import:icd10` |
| Backups | None | Per-client, encrypted, tested restores |

## Phase plan

- **Phase 1 (this):** login, roles, client separation, Patient Entry, Ledger,
  Charge Entry, Payment Posting (bulk), notes, alerts, reversals, close books,
  audit log.
- **Phase 2:** CMS-1500 paper claims, 837P electronic claims (test mode), claim
  status on the ledger, line-item payment posting, statements, call list,
  scanned documents, data menus (providers, facilities, payers, fee schedules),
  user management screen, MFA.
- **Phase 3:** Rules library with sources, rules check on charges and claims,
  Work Comp RFA and Second Bill Review, VA payer rules.
- **Phase 4:** Client portal: dashboard, patients, billing status, reports.
- **Phase 5:** CENCOM inbound API, clearinghouse connections, 835 payments,
  277/999 status, eligibility.
