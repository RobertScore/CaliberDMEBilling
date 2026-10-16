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
- Open **http://localhost:5000** in your browser.

To stop it, click the Terminal window and press `Ctrl+C`.

## Things to try

| Sign in as | What you can do |
|---|---|
| owner@caliber.test | Everything, in all 3 demo clients |
| manager@caliber.test | Everything, in SCORE (DEMO) and Pacific (DEMO) |
| biller@caliber.test | Register patients and post charges, in SCORE (DEMO) only |
| poster@caliber.test | Post payments, in SCORE (DEMO) only |
| auditor@caliber.test | Look only, plus the audit log |

- **Shortcuts** (after picking a client): `Ctrl+R` Patient Entry, `Ctrl+L`
  Ledger, `Ctrl+K` Charge Entry, `Ctrl+P` Payment Posting. `Alt` + the same
  letter also works.
- Open the ledger for `TEST-SCORE, PATIENT ONE` to see the alert pop up and the
  color-coded entries.
- Switch clients at the top. Everything from the previous client disappears,
  because each client is a separate database.
- Sign in as the biller and notice Payments is greyed out. If you tried anyway,
  the server refuses it.
- Type a DOB as `03151985` and watch the slashes appear.

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
