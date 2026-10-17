# Open Questions

Caliber's team answers these in the shared doc
**"Caliber DME Billing – Open Questions"**
(https://claude.ai/code/artifact/fa20b9d2-9cd0-48bb-9d5c-5768db9a11ca).
Claude copies the answers here and updates the code. "Best guess" is what the
software does until a question is answered. In code, a guess is marked
`// ASSUMPTION Q-0XX`.

## Team, roles and permissions

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-001 | What job roles does Caliber's team have? | Owner/Super Admin, Billing Manager, Biller, Payment Poster, Collections/AR, Read-only/Auditor | Open |
| Q-002 | Do staff work only on certain clients, or all? | Each person is assigned to specific clients by a manager | Open |
| Q-003 | Who can see a full SSN? | Last 4 only; Billing Manager and up can reveal it, and every reveal is logged | Open |
| Q-004 | Do we need the SSN at all? | Store it (it's in the spec) but make it optional | Open |
| Q-005 | Who can close the books? | Billing Manager and Owner, closing monthly | Open |
| Q-006 | Combined reports across all clients? | Totals and counts only, with no patient details | Open |
| Q-007 | How long before an idle login times out? | 15 minutes, with a warning at 13 | Open |

## Billing rules

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-010 | Which states have the most Work Comp volume? | California, Texas, Florida and New York first, then the rest | Open |
| Q-011 | Who approves rules before they show in the software? | Billing Manager; each rule rechecked every 12 months | Open |
| Q-012 | Should Work Comp or VA patients ever get statements? | No | Open |
| Q-013 | How are rentals handled? | Purchase and monthly rental, with rules set per payer and state | Open |
| Q-014 | Which filing deadlines are tracked? | Set per payer and state, with warnings at 30 and 10 days | Open |
| Q-015 | Which VA Community Care administrators do you bill? | Each is its own payer, plus VA direct | Open |
| Q-016 | Do clients have contract rates that override fee schedules? | Yes: a rate per client, payer and code | Open |
| Q-017 | Which documents are required before an order is ready to bill? | Rx, delivery ticket, PO, RFA/RFS plus approval, chart notes, demographics, insurance, WC claim number and date of injury, VA referral number | Open |
| Q-018 | AMA CPT license? | Not licensed; HCPCS and ICD-10 only for now | Answered (2026-10-16): skip CPT for now, plan for it |

## Client portal and patient portal

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-020 | What goes on the client dashboard? | Billed, collected and outstanding dollars; claims by status; denials needing action; orders missing documents | Open |
| Q-021 | Can clients edit anything? | View and report only, plus document upload and messages | Open |
| Q-022 | Which client reports are needed on day one? | Aging, collections, denials, orders by status, custom builder with Excel/PDF export | Open |
| Q-023 | Can clients manage their own portal users? | Yes, through a Client Admin | Open |
| Q-024 | What will the patient portal (later) do? | Own orders and billing status, messages, document upload | Open |

## Systems, data, hosting and the CENCOM link

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-030 | DigitalOcean or Supabase, and is the BAA signed? | DigitalOcean, BAA-covered products only | Open |
| Q-031 | Which clearinghouses? | One common connection layer; Office Ally first (the current system uses it) | Open |
| Q-032 | Move data over from the old system? | Start fresh; move open balances and active patients later | Open |
| Q-033 | How long are records kept? | 10 or more years, never deleted automatically | Open |
| Q-034 | Will other clients send orders by API? | Yes; SCORE's CENCOM first | Open |
| Q-035 | Which outside services touch PHI? | None until a BAA is signed | Open |

## Screens and the spec spreadsheet

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-040 | Is it OK to use other shortcut keys where the browser blocks Ctrl+R/L/P/O? | Keep them where possible; otherwise Alt+R/L/K/P/O | Open |
| Q-041 | Screenshots and the old system's name? | Cal-Med "Practice Expert" 2018, claims through Office Ally | Answered (2026-10-16): 83 screenshots read |
| Q-042 | Which reports are used most? | Daily Activity, Aging, Monthly Historical Receivables, Employee Daily Productivity | Open |
| Q-043 | Is the patient ID assigned by the system or typed by staff? | System-assigned; the old ID kept in a separate field | Open |
| Q-044 | Can someone send the sheet rows no screenshot showed (mostly DATA MENU)? | Use standard CMS-1500/837P fields until then | Open |
| Q-045 | Where are the sample report printouts ("included in documents")? | Design from the report settings screens | Open |
| Q-046 | Should past-due patient messages ever apply to Work Comp or VA? | No; only payer types that allow patient billing | Open |
| Q-047 | Which Work Comp forms are used besides the RFA and Second Bill Review? | Build those two first | Open |
| Q-048 | Which write-off and patient-share reasons carry over? | All of them, as editable lists that managers can hide | Open |

## Raised while building Phase 1

| ID | Question | Best guess | Status |
|---|---|---|---|
| Q-050 | When a payer type doesn't match the patient's coverage type (e.g. a WC patient with a VA payer), should the software block it or just warn? | Allow it for now; Phase 3 rules check will flag it | Open |
| Q-051 | Should a Work Comp / VA patient-share entry be blocked outright, or allowed with a warning? | Allowed with a warning (see Q-012, Q-046) | Open |
| Q-052 | Should removing a patient be blocked while the account still has a balance? | Not blocked yet; management only, and nothing is erased | Open |
| Q-053 | The patient portal shows a "Your balance" figure. Work Comp and VA patients generally can't be billed. Should their portal hide the balance entirely? | It shows only the patient share that staff have posted, which is normally $0 for WC and VA | Open |
| Q-054 | Will Caliber sign a BAA with Anthropic so the AI reader can read real paperwork (including handwriting)? | On for the local demo with fake data (Robert, 2026-10-17); paused before real PHI unless the BAA is signed. Every value it reads is shown with a "how sure" color and must be checked by a person before it's saved | Open |
| Q-055 | When paperwork comes in, how sure must the match be before we treat it as an existing patient? | Same date of birth + same name (or a matching claim number or SSN last 4) = "strong match", picked automatically. Creating a new patient over a strong match needs a "this is a different person" tick | Open |
| Q-056 | Which documents does each payer type need before billing? (Settings → Required documents) | The starting grid in Settings, built from Q-017. Caliber can change it there any time | Open |
| Q-057 | Rules for "View as" (seeing the app exactly as another user does): who may use it? | Owner and Billing Managers only, read-only, a reason is required, and the start and stop are logged | Open |
| Q-058 | How should multi-factor login work (app code, text message, email)? | Off for now (Robert, 2026-10-17). Still required before real patient data (CLAUDE.md 3.2). Leaning toward an authenticator app | Open: decision deferred |
| Q-059 | Temporary passwords: new users and resets get a one-time password they must change at first sign-in (12+ characters, letters and a number). Is that policy OK? | Yes, as built | Open |
| Q-060 | A patient with two separate Work Comp injuries (two claim numbers): is it OK to keep each claim in its own insurance slot (up to 3), labeled "Work Comp claim 1 / 2"? | Yes for now. Each charge picks which slot/claim it bills. A fuller "case" per injury may be better later | Open |
| Q-061 | When a packet contains a page about a different patient, what should happen to it? | It's set aside: never filed to this patient, kept only in the full packet in the Inbox, and the intake note says which pages. Nobody is alerted automatically yet | Open |
| Q-062 | Pages of a packet that aren't put in any part (cover sheets, blanks): keep them only in the full packet? | Yes, the full packet is kept permanently with the Inbox item | Open |
| Q-063 | CDC sometimes publishes a mid-year ICD-10-CM update (e.g. April 1). The April 2026 one added no new codes. If a future April update adds codes, do you want them loaded from April 1? | Today only the October releases are loaded (that's where CDC publishes the code-list text files). Flagged so we watch for April releases with new codes | Open |
| Q-064 | When CMS rewords a HCPCS description, do you need the old wording kept for old claims? | No: the code and its start/end dates are what matter; the latest wording is shown | Open |
| Q-065 | Staff often search by nicknames (e.g. "ACL" for anterior cruciate ligament). Want a list of common shortcuts added to code search? | Not built; search uses the official wording and the code itself | Open |
