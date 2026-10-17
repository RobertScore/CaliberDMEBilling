# Running Caliber DME Billing on your Mac

This runs a **local demo with fake data only**. Nothing is sent anywhere and no real
patient data should ever be typed in. Real patient data waits until the app is
hosted under Caliber's signed BAA.

## One-time setup

1. Check that you have Node.js 20 or newer. In Terminal:
   ```
   node -v
   ```
   If it prints `v20…` or higher, you're set. Otherwise, install the "LTS"
   version from https://nodejs.org.

## Start it

In Terminal, from your `CaliberDMEBilling` folder:

```
git pull
git checkout claude/phase-1-foundation
npm install
npm run dev
```

- The first start creates a `data/` folder inside the project with the demo
  databases, one per fake client.
- Terminal prints the **demo logins**. They're also saved in
  `data/DEMO_LOGINS.txt`.
- Open **http://localhost:3000** in your browser.

To stop it, click the Terminal window and press `Ctrl+C`.

## Things to try

| Sign in as | What you can do |
|---|---|
| owner@caliber.test | Everything, in all 3 demo clients, including Users & access, View as and Settings |
| manager@caliber.test | Everything in SCORE (DEMO) and Pacific (DEMO) |
| biller@caliber.test | Inbox, register patients, post charges, notes, in SCORE (DEMO) only |
| poster@caliber.test | Post payments, in SCORE (DEMO) only |
| auditor@caliber.test | Look only, plus the audit log |
| portal@score-demo.test | The **client portal** for SCORE (DEMO) |
| patient@demo.test | The **patient portal** for TEST-SCORE, PATIENT ONE |

- **Paperwork in:** open **Inbox**. Two sample items are waiting: a fax for a
  new patient and an email for an existing one. Open one: the paper is on the
  left, what was read is on the right (red = unsure, amber = fairly sure).
  Pick new or existing, check the document types, tick Verified, and file it.
  The "Sample" buttons at the top bring in more fake paperwork.
- **The patient Overview:** all three insurances, claims, what's owed by age,
  the ready-to-bill document checklist, alerts, follow-ups, and one history of
  everything. Add a note with a template and a follow-up date.
- **Many patients at once:** open several patients (press `/` each time). They
  stay as tabs across the top and keep their place. Click **Side by side** on a
  patient to show a second one next to it.
- **Live updates:** sign in as the biller in a second browser (or a private
  window) and add a note. It appears on the owner's screen by itself.
- **Call List** (`Ctrl+O`): follow-ups from notes, overdue first.
- **Reports:** daily activity, aging, monthly receivables, team productivity,
  each downloadable as CSV.
- **Settings:** note templates, drop-down lists, codes, payers, required
  documents, providers and facilities, company info and ledger colors, API keys.
- **View as:** Users & access → View as next to the biller. A purple bar shows
  it's read-only. Click Leave to come back.
- **Shortcuts:** `/` find a patient, `Ctrl+R` register, `Ctrl+K` charges,
  `Ctrl+P` payment, `Ctrl+L` ledger, `Ctrl+O` call list. `Alt` + the same
  letter also works.
- **Switching clients** (top of the sidebar) closes all open patients and
  clears everything from the previous client.

## The AI reader (later)

It is built but **off**. It must stay off until Caliber has a signed BAA with
Anthropic (see `docs/VENDORS_AND_BAAS.md`). Once that's signed, the server is
started with `CALIBER_AI_READER=anthropic`, `CALIBER_AI_BAA_CONFIRMED=yes` and
an `ANTHROPIC_API_KEY` kept in the hosting provider's secret storage.

## Start over with fresh demo data

```
npm run reset-demo
npm run dev
```

New demo passwords are created each time.

## Run the automated checks

```
npm test
```
