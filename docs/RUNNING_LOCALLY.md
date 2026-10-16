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
| owner@caliber.test | Everything, in all 3 demo clients |
| manager@caliber.test | Everything, in SCORE (DEMO) and Pacific (DEMO) |
| biller@caliber.test | Register patients and post charges, in SCORE (DEMO) only |
| poster@caliber.test | Post payments, in SCORE (DEMO) only |
| auditor@caliber.test | Look only, plus the audit log |

- **Find anyone fast:** press `/` anywhere, type a name, then press `Enter`.
- **Shortcuts:** `Ctrl+R` registers a patient. `Ctrl+K` posts charges, `Ctrl+P`
  posts a payment, and `Ctrl+L` opens the ledger. If a patient is already open,
  these go straight to that patient. `Alt` + the same letter also works.
- **Follow a whole claim:** register a patient, and you land on Post charges.
  Post them, then Post a payment. The account header always says what to do
  next.
- **The patient workspace:** Activity (by claim, or the classic color-coded
  ledger), Post charges, Post a payment, Patient & insurance, Notes & alerts.
- **Alerts:** open `TEST-SCORE, PATIENT ONE` and the alert pops up straight away.
- **Switching clients** (top of the sidebar) clears everything from the
  previous client.
- **Roles:** sign in as the biller and notice Post a payment is greyed out. If
  they tried anyway, the server would refuse.

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
