# Caliber DME Billing

Web-based DME billing software owned by **Caliber DME Billing**. Caliber bills on
behalf of multiple DME distributors. Each client's data lives in its own separate
database.

Status: **Phase 1 built (local demo, fake data only).** See
[`docs/RUNNING_LOCALLY.md`](docs/RUNNING_LOCALLY.md) to run it, and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it works and what's still
needed before real patient data can go in.

```
npm install
npm run dev     # then open http://localhost:3000
npm test        # automated checks
```

- [`CLAUDE.md`](CLAUDE.md): the rules every change must follow (read this first)
- [`docs/spec/SCREEN_SPEC.md`](docs/spec/SCREEN_SPEC.md): the screen-by-screen spec, taken from the current system
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md): questions for Caliber's team, with our current best guesses
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how client separation, the ledger and permissions work
- [`docs/VENDORS_AND_BAAS.md`](docs/VENDORS_AND_BAAS.md): outside services allowed to handle patient data

**This repository must never contain patient data, real screenshots or secrets.**
