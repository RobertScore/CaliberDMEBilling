# Sample intake packets: answer key

All people, numbers, payers and clinics are FAKE. Forms are modeled on public Work Comp and VA forms but are not the official forms.
Diagnosis and HCPCS codes are used only to test reading; they are not billing advice.

How to test: in the app, Inbox -> Add paperwork -> drop one PDF. When it's read, compare the review screen with the right answers below.
Score each field: right / wrong / left empty, and note whether the reader flagged each trap in its notes.

## 01-wc-kitchen-sink-26pg.pdf (26 pages)

Work Comp, new patient. A long referral with lots of noise.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-RIVERA |
| firstName | DANIEL |
| middleInitial | J |
| dob | 1984-02-17 |
| sex | M |
| ssn | 000000101 |
| address1 | 410 SAMPLE AVE APT 3 |
| city | SAN DIEGO |
| state | CA |
| zip | 92103 |
| phone | 555-0121 |
| cellPhone | 555-0122 |
| email | d.rivera@example.test |
| employer | EXAMPLE FREIGHT LLC |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | GOLDEN STATE COMP MUTUAL (TEST) |
| payerType | WC |
| claimNumber | TEST-WC-10442 |
| dateOfInjury | 2026-09-03 |
| employerName | EXAMPLE FREIGHT LLC |
| adjusterName | JORDAN SAMPLE |
| adjusterPhone | 555-0177 |
| authorizationNumber | TEST-AUTH-10442-A |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** L1833, E0218, E0114

**Hcpcs approved:** L1833, E0114

**Icd10:** S83.511A, S83.241A, M25.561

**Traps (things that should NOT be picked, or should be flagged):**

- Spouse Maria Rivera's DOB (05/30/1986), phone and employer appear on the face sheet and personal insurance card.
- Personal health plan card (PACIFIC COAST HEALTH PLAN) is NOT the payer for a work injury.
- Old 2019 claim TEST-PC-2019-0811 (PINECREST CASUALTY, left ankle, DOI 06/11/2019, adjuster RANDY OLDCLAIM) is closed and unrelated.
- Attorney letter lists phone '555-0177 ext 2'; the adjuster's phone is 555-0177 (no extension); attorney is not the adjuster.
- E0218 cold therapy was requested but NOT certified by UR; only L1833 and E0114 are authorized.
- Nurse case manager phone 555-0179 is not the adjuster's.
- Old 2019 note lists ICD S93.401A and HCPCS L4361 - not part of this order.
- Patient goes by 'Danny'; legal first name is DANIEL.

## 02-wc-misfiled-duplicate-upsidedown-23pg.pdf (23 pages)

Work Comp (Texas), new patient. Poor fax. Contains a misfiled page from a DIFFERENT patient (twice), a duplicated Rx page, an upside-down RFA page, a blank page and a junk ad.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-CHEN |
| firstName | LINDA |
| dob | 1979-11-08 |
| sex | F |
| ssn | 000000102 |
| address1 | 77 TEST LANE |
| city | AUSTIN |
| state | TX |
| zip | 78702 |
| phone | 555-0131 |
| employer | SAMPLE BAKERY CO |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | SUNBELT WC ADMINISTRATORS (TEST) |
| payerType | WC |
| claimNumber | TEST-TX-58810 |
| dateOfInjury | 2026-09-28 |
| adjusterName | MORGAN EXAMPLE |
| adjusterPhone | 555-0178 |
| authorizationNumber | TEST-TXPA-2201 |

**Orderingphysician:** Rita Example, DO (fictional)

**Hcpcs ordered:** L3809

**Icd10:** S63.501A

**Traps (things that should NOT be picked, or should be flagged):**

- Pages 7 and 22 belong to a different patient (DEMO-CHENG, LINDSAY, DOB 11/18/1981, left shoulder, M75.101). A good reader flags this and does NOT mix her details in.
- Page 8 (the RFA) is upside down.
- Page 9 duplicates the Rx on page 4.
- Brother Wei Chen's phone 555-0132 is not the patient's.

## 03-wc-moved-name-change-corrections-20pg.pdf (20 pages)

Work Comp, new patient. She moved and changed her name; old address, old phone and maiden name appear on several pages; staff corrected values by hand.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-OCONNOR-WELLS |
| firstName | KATHERINE |
| middleInitial | A |
| dob | 1991-08-05 |
| sex | F |
| ssn | 000000103 |
| address1 | 2290 NEW MESA RD #12 |
| city | SAN DIEGO |
| state | CA |
| zip | 92123 |
| phone | (none) |
| cellPhone | 555-0142 |
| email | kate.ow@example.test |
| employer | EXAMPLE CITY SCHOOLS |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | GOLDEN STATE COMP MUTUAL (TEST) |
| payerType | WC |
| claimNumber | TEST-WC-20733 |
| dateOfInjury | 2026-08-21 |
| adjusterName | CASEY TESTER |
| adjusterPhone | 555-0176 |
| authorizationNumber | TEST-AUTH-20733 |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** L0650, E0730, A4595

**Icd10:** M51.16, M54.50

**Traps (things that should NOT be picked, or should be flagged):**

- Old address 18 OLD HARBOR DR 92106 and old home phone 555-0141 appear on the face sheet; the update page and intake show the NEW address.
- Older pages use the maiden last name DEMO-OCONNOR.
- Preferred name 'Kate' vs legal 'KATHERINE'.
- Husband Tom Wells's phone 555-0143 is not hers.

## 04-va-ccn-expired-vs-active-referral-20pg.pdf (20 pages)

VA Community Care, new veteran. Two referrals: an EXPIRED one and an ACTIVE one. Also a Medicare Advantage card that is not the payer for VA referral care.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-WASHINGTON |
| firstName | JAMES |
| middleInitial | R |
| dob | 1958-05-30 |
| sex | M |
| address1 | 3 VETERAN WAY |
| city | PHOENIX |
| state | AZ |
| zip | 85003 |
| phone | 555-0151 |
| cellPhone | 555-0152 |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | COMMUNITY CARE TPA (TEST) |
| payerType | VA_CCN |
| referralNumber | TEST-CCN-55120 |
| authorizationNumber | TEST-AUTH-55120-1 |

**Orderingphysician:** Sam Testwell, MD (fictional)

**Hcpcs ordered:** E0143

**Icd10:** M17.11

**Traps (things that should NOT be picked, or should be flagged):**

- Expired referral TEST-CCN-31007 / TEST-AUTH-31007 (ended 06/30/2026).
- Medicare Advantage card TSA-552-0091 is not the payer here.
- Daughter Denise's DOB, phone, and requested delivery address (88 DAUGHTER LN, MESA) are not the Veteran's.

## 05-va-direct-revised-auth-cancelled-items-19pg.pdf (19 pages)

VA direct (prosthetics). The first authorization included a TENS unit; the revised authorization cancels it (patient has a pacemaker). Only the LSO should be delivered and billed.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-OKAFOR |
| firstName | GRACE |
| dob | 1969-12-02 |
| sex | F |
| address1 | 12 PRACTICE CT |
| city | SAN DIEGO |
| state | CA |
| zip | 92108 |
| phone | 555-0161 |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | VA MEDICAL CENTER - DIRECT (TEST) |
| payerType | VA_DIRECT |
| authorizationNumber | TEST-VA-PO-7719-R1 |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** L0650, E0730, A4595

**Hcpcs active:** L0650

**Icd10:** M54.50, M51.16

**Traps (things that should NOT be picked, or should be flagged):**

- Original authorization TEST-VA-PO-7719 was replaced by TEST-VA-PO-7719-R1.
- E0730 and A4595 are CANCELLED on the revised authorization.
- Son Chidi's phone 555-0162 is not hers.

## 06-existing-patient-one-new-second-claim-24pg.pdf (24 pages)

EXISTING patient (TEST-SCORE, PATIENT ONE). He already has a knee claim (TEST-CLM-00). This packet is a NEW right-shoulder injury with a NEW claim number and adjuster. Knee pages are included for reference.

**Should be:** existing: TEST-SCORE, PATIENT ONE

**Patient**

| Field | Right answer |
|---|---|
| lastName | TEST-SCORE |
| firstName | PATIENT ONE |
| dob | 1980-01-01 |
| sex | M |
| address1 | 123 TEST STREET |
| city | SAN DIEGO |
| state | CA |
| zip | 92101 |

**Insurance for this order**

| Field | Right answer |
|---|---|
| payerName | GOLDEN STATE COMP MUTUAL (TEST) |
| payerType | WC |
| claimNumber | TEST-WC-31950 |
| dateOfInjury | 2026-10-01 |
| adjusterName | ALEX NEWADJUSTER |
| adjusterPhone | 555-0175 |
| authorizationNumber | TEST-AUTH-31950 |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** E0218

**Icd10:** M75.101, S43.421A

**Traps (things that should NOT be picked, or should be flagged):**

- The existing knee claim TEST-CLM-00 (DOI 08/01/2026, TEST ADJUSTER, auth TEST-AUTH-44120) must not be overwritten.
- Knee diagnoses S83.511A / M25.561 and L1833 belong to the old claim.
- Sibling Pat Test 555-0198 is not the patient.
- Reviewer should attach to the existing patient and ADD the new claim as another insurance entry, not replace the knee claim. (Today the intake screen only merges by insurance rank - see notes.)

## 07-tx-wc-conflicting-injury-dates-handwritten-20pg.pdf (20 pages)

Work Comp (Texas), new patient. Lots of handwriting. The employer report says DOI 09/30/2026 at 8 AM; the employee, doctor and carrier say 09/29/2026 at about 2 PM.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-HERNANDEZ |
| firstName | LUIS |
| dob | 1977-03-09 |
| sex | M |
| ssn | 000000107 |
| address1 | 410 RANCH RD |
| city | AUSTIN |
| state | TX |
| zip | 78745 |
| phone | 555-0171 |
| employer | SAMPLE ROOFING TX |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | SUNBELT WC ADMINISTRATORS (TEST) |
| payerType | WC |
| claimNumber | TEST-TX-60177 |
| dateOfInjury | 2026-09-29 (employer report conflicts: 09/30/2026) |
| adjusterName | MORGAN EXAMPLE |
| adjusterPhone | 555-0178 |
| authorizationNumber | TEST-TXPA-3107 |

**Orderingphysician:** Rita Example, DO (fictional)

**Hcpcs ordered:** L4361, E0114

**Icd10:** S93.401A

**Traps (things that should NOT be picked, or should be flagged):**

- Employer's report DOI 09/30/2026 conflicts with everyone else (09/29/2026).
- Witness Joe Coworker 555-0291 and wife Ana 555-0172 phones are not the patient's.
- Employer phone 555-0290.

## 08-two-employers-two-claims-24pg.pdf (24 pages)

Work Comp, new patient with TWO open claims at two jobs. The back brace was denied on the hospital claim; the wrist brace was approved on the cafe claim. The order to bill is the WRIST on the CAFE claim.

**Should be:** new

**Patient**

| Field | Right answer |
|---|---|
| lastName | DEMO-NAKAMURA |
| firstName | REI |
| dob | 1986-12-12 |
| sex | F |
| ssn | 000000108 |
| address1 | 5 TWOJOBS CT |
| city | SAN DIEGO |
| state | CA |
| zip | 92117 |
| phone | 555-0181 |
| email | rei.n@example.test |
| employer | SAMPLE CAFE (for this order) |

**Insurance for this order**

| Field | Right answer |
|---|---|
| payerName | PINECREST CASUALTY (TEST) |
| payerType | WC |
| claimNumber | TEST-PC-41877 |
| dateOfInjury | 2026-09-02 |
| employerName | SAMPLE CAFE |
| adjusterName | RANDY OLDCLAIM |
| adjusterPhone | 555-0232 |
| authorizationNumber | TEST-AUTH-41877 |

**Also on file**

| Field | Right answer |
|---|---|
| payerName | GOLDEN STATE COMP MUTUAL (TEST) |
| claimNumber | TEST-WC-41001 |
| dateOfInjury | 2026-07-14 |
| employerName | EXAMPLE HOSPITAL |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** L3809

**Icd10:** S63.501A

**Traps (things that should NOT be picked, or should be flagged):**

- Two WC claims; the order belongs to the cafe claim.
- L0650 on the hospital claim was NOT certified - not part of this order.
- Personal plan card is not the payer.
- Father Ken's phone 555-0182 is not hers.

## 09-existing-patient-two-va-renewal-other-coverage-20pg.pdf (20 pages)

EXISTING patient (TEST-SCORE, PATIENT TWO). Same referral, renewed authorization. Also has a Medicare Advantage card (not the payer for VA referral care).

**Should be:** existing: TEST-SCORE, PATIENT TWO

**Patient**

| Field | Right answer |
|---|---|
| lastName | TEST-SCORE |
| firstName | PATIENT TWO |
| dob | 1975-06-15 |
| sex | F |
| address1 | 123 TEST STREET |
| city | SAN DIEGO |
| state | CA |
| zip | 92101 |
| phone | 555-0199 |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | COMMUNITY CARE TPA (TEST) |
| payerType | VA_CCN |
| referralNumber | TEST-REF-01 |
| authorizationNumber | TEST-AUTH-REF01-2 |

**Orderingphysician:** Sam Testwell, MD (fictional)

**Hcpcs ordered:** L1851, E0143

**Icd10:** M17.11

**Traps (things that should NOT be picked, or should be flagged):**

- Old authorization TEST-AUTH-REF01-1 ended 10/14/2026.
- Medicare Advantage TSA-220-1144 is not the payer.
- Partner Sam Test 555-0197 is not the patient.

## 10-same-name-different-person-20pg.pdf (20 pages)

NEW patient whose name is the SAME as an existing patient (TEST-SCORE, PATIENT ONE) but who is a different person: different DOB (10/01/1980 vs 01/01/1980), address, SSN and claim. The match screen should NOT call this a strong match; the reviewer should create a new patient.

**Should be:** new (name matches TEST-SCORE, PATIENT ONE, but DOB/SSN/address differ)

**Patient**

| Field | Right answer |
|---|---|
| lastName | TEST-SCORE |
| firstName | PATIENT ONE |
| dob | 1980-10-01 |
| sex | M |
| ssn | 000000110 |
| address1 | 9 DIFFERENT AVE |
| city | CHULA VISTA |
| state | CA |
| zip | 91910 |
| phone | 555-0111 |
| employer | EXAMPLE MARINE SUPPLY |

**Insurance primary**

| Field | Right answer |
|---|---|
| payerName | GOLDEN STATE COMP MUTUAL (TEST) |
| payerType | WC |
| claimNumber | TEST-WC-50110 |
| dateOfInjury | 2026-10-04 |
| adjusterName | CASEY TESTER |
| adjusterPhone | 555-0176 |
| authorizationNumber | TEST-AUTH-50110 |

**Orderingphysician:** Alan Sample, MD (fictional)

**Hcpcs ordered:** L1833 (LT)

**Icd10:** M25.562

**Traps (things that should NOT be picked, or should be flagged):**

- Same name as an existing patient; DOB 10/01/1980 vs 01/01/1980 (written '10/1/80' by hand - easy to misread as 1/10/80).
- First report lists M25.561 (RIGHT knee) in error; the addendum corrects it to M25.562 (LEFT).
- Cousin Lee Test 555-0112 is not the patient.
- Poor fax quality.
