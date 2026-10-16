# Vendors and BAAs

A vendor can touch patient data (PHI) **only** if Caliber DME Billing has a signed
Business Associate Agreement (BAA) with it, and only for the products that BAA
covers. If a vendor or product isn't marked **Signed** here, it can't be used
for PHI.

| Vendor | What for | Products covered by the BAA | BAA status | Signed date | Notes |
|---|---|---|---|---|---|
| DigitalOcean or Supabase | Hosting, database, file storage | To be confirmed | **Not signed yet (Caliber)** | | SCORE's CENCOM BAA with DigitalOcean does not cover Caliber; Caliber needs its own. See Q-030. |
| Clearinghouse(s) | Electronic claims, remittance, claim status | n/a | **Not signed yet** | | See Q-031. |
| Email / fax / SMS provider | Notifications, statements | n/a | **Not chosen** | | See Q-035. |
| AI provider | Rule explanations, document reading | n/a | **Not chosen** | | No PHI is sent until a BAA is signed. |

## Client BAAs (Caliber ↔ each DME client)

| Client | BAA status | Signed date |
|---|---|---|
| SCORE (Southern California Orthopedic Rehab Equipment) | Pending | |
