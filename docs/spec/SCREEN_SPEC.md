# Caliber DME Billing: Screen Spec from the Old System

This file was built from the 83 screenshots of the "SOFTWARE SPECS - Caliber DME" sheet, taken on 2026-10-16. Each screenshot was read as an image.

- **Old system:** Cal-Med "Practice Expert" (Version 2018). Claims go through Office Ally.
- **Patient data:** all of it was removed. Patient, staff and referring-physician names, IDs and contact details are written as [REDACTED]. The patient screens showed a dummy "TEST, TEST" record.
- **"UNUSED FEATURE":** anything the sheet marks this way is out of scope unless Robert says otherwise.
- **"(guess)":** the screenshot was hard to read. Check these against the sheet.
- **Order:** sections follow the screenshots in the order they were taken, which is also the order of the tabs. Some tabs (FILE MENU, STATEMENTS, DATA MENU) continue across more than one section.

## Gaps: rows not shown in any screenshot

| Tab | Missing |
|---|---|
| PT ENTRY | Rows 1-51 (partly covered by the sheet's own text) |
| CHARGE ENTRY, PAYMENT POSTING | The Y/N columns for the rows in the screenshots are blank |
| PAT MENU | The Y/N columns are scrolled off screen |
| STATEMENTS | Rows 3-15, 127-135 and 181-187; options in the Print Statement dropdown |
| WORKCOMP | Rows 32-39 |
| DATA MENU | Rows 58-102 (Billing Provider), 133-145, 243-288 (Facility), 366-413 (Insurance Carrier), 496-504, 547-573 (Procedure Code), 712-773 (Rendering Provider), 851-886 (Referring Physician) |
| REPORTS | Aging Report period settings are only partly readable |

## PT ENTRY (screenshot 1)

**Spec sheet (user-written):**
- A1 header: "IN ORDER:". Column headers visible: B MANUAL ENTRY?, C SHORT CODE?, D NUMBER OF CHARACTERS, E MULTIPLE FIELDS?, F DROP DOWN?
- Rows 52-81: columns B-E are blank. Column F (DROP DOWN?) shows a checkbox value of `FALSE` on every row (52-81). These look like unchecked checkboxes, not deliberate answers (guess).
- Row 53: "EXAMPLE:" followed by a pasted old-system screenshot (rows 54-72).
- Rows 74-75 (rule): **"PRIMARY SUBSCRIBER, SECONDARY SUBSCRIBER, AND TERTIARY SUBSCRIBER SHOULD ALL AUTO FILL ONCE YOU SELECT "RELATIONSHIP TO INSURED", FROM THE PATIENT SECTION."**

**Old system: "Register New Patient (Ctrl+R)"**
- Toolbar: Ok, Print, (two icons), Pat, Ins, Ledger, New Call, Pend Calls, (alert/warning icons), Recs, Photo, Pict List, Scan Pict, Scan, Find, Cancel.
- **Patient** section: ID [REDACTED], Ext, SSN, Alias, Family Account (N), Class, Archive; Last, First, MI, Title, DOB, Age, Sex (dropdown), Marital (dropdown), search icon; Addr1, 2, Zip (search), City, ST, Country; Phone, HIPAA/Cell Phone, Drv Lic, Chart#, Email, Opt Out; Status (dropdown), Occup, Employer (search), Work Phone, Ext, ONC info; Release (dropdown), Deceased (N), Language (dropdown).
- **Responsible Party**: Pat Relationship to Resp (dropdown), Last, First, MI, Title; Addr1, 2, Zip, City, ST, Country; Phone, Cell, SSN, Drv Lic, Email; Employer, W Phone, Ext, Occup.
- **Nearest Relative**: Name, Relationship, Phone, Call in Emergency.
- Coverage (search), Prm Dr (search), Facility (H), Fee Schedule, Referring Dr, Ref Source, Asst; Maintain Separate Patient Ledger (N), Pt is Exempt from Clinical & Mkt Reporting (N); buttons Claim, Statement, Pat Privacy, Surgery, Marketing.
- **Primary Insurance**: Carrier (search), Claim, Copay, Ded, Limit, Elig From (calendar), To (calendar).
- **Primary Subscriber**: Pat Relationship to Insured (dropdown), Last, First, MI; Addr1, 2, Zip, City, ST, Phone; Sex, DOB, Primary ID/MBI, Group/policy No, Group/Plan Name.
- **Secondary Insurance**: Carrier, Claim, Copay, Medicare Ins Type Code (dropdown); Coverage, Fee Schedule, Eligible From, To.
- **Secondary Subscriber**: Pat Relationship to Insured, Last, First, MI, Addr1, 2, Zip, City, ST, Phone (cut off).

## PT LEDGER (screenshots 2-5)

**Spec sheet (user-written), in row order:**
- Row 11 (partly cut off): "...LINE ITEMS, OTHER INFO LISTED ABOVE"
- Row 12: "CLAIM SUBMISSION (WHEN CLAIM PRINTED, TYPE, TO WHOM)"
- Row 14: **FINANCIAL POSTINGS**
- Rows 15-16 (rule): "ALL POSTINGS HAVE DIFFERENT COLORS. WE CAN CHANGE SETTINGS TO ADJUST COLORS. CLAIM DATA (PINK), CHARGES ENTERED (BROWN) CHARGES ENTERED (TURN YELLOW ONCE CLAIM POPULATED) CLAIM SUBMISSION (WHITE) PAYMENTS (GREEN), WRITE OFF'S (RED), PATIENT SHARE'S (BLUE), REFUNDS (PURPOSE [sic, likely PURPLE]), ADJUSTMENTS (ORANGE)."
- Row 31: **FUNCTIONS:**
  - POST PAY: "POST PAYMENTS RECEIVED TO PATIENT ACCOUNT"
  - NOTES: "EVERY ACTION IN ACCOUNT MUST BE NOTED BY EMPLOYEE. SUCH AS EMAILS RECEIVED, REQUESTS SENT, ETC." + "**NOTES CANNOT BE LATER EDITED OR REMOVED.**"
  - ALERTS: "ALERT A WARNING OR INFORMATION ONTO FILE. ALERT WILL DISPLAY AS SOON AS YOU OPEN A PATIENT ACCOUNT, IF ONE IS PRESENT." + "THESE ARE MANUALLY ENTERED, AND CAN BE REMOVED."
  - (rows 36-50: screenshot of ledger with ALERT popup)
  - Row 53 PRINT: "OPTION TO PRINT A COPY OF THE LEDGER."
  - Row 66 REMOVE: "REMOVE PATIENT SET UP." + "**ONLY MANAGEMENT HAS ACCESS TO REMOVE ANYTHING.**"
  - Row 67 PAT: "OPEN PATIENT REGISTRATION, AS SHOWN IN "PT ENTRY" TAB."
  - Row 68 PRVW ELEC: "PREVIEW ELECTRONIC CLAIMS"
  - Row 69 SUMMARY: "SUMMARY OF AGINGS, AND LEDGER ENTRIES"
  - (rows 71-84: Financial Summary screenshot)
  - Row 86 SCAN: "SCAN VARIOUS DOCUMENTS INTO SPECIFIC PATIENT FILES. SUCH AS PRESCRIPTIONS, DEMOS, PO'S, ETC. MUST HAVE LARGE SPACE CAPACITY AS WE MUST MAINTAIN ALL DOCUMENTATION."
  - Row 87 FIND: "SEARCH SCANNED DOCUMENTS WITHIN THE PATIENT FILE."
  - Row 88 PEND CALLS: "OPEN ACTIVE PENDING CALLS ON SPECIFIC PATIENT ACCOUNT"
  - Row 89 NEW CALLS: "SET NEW CALL FOR FOLLOW UP ON SPECIFIC PATIENT ACCOUNT"
- Settle and Toggle Cycle appear as toolbar buttons in the old system, but no spec row for them is visible in this batch.

**Old system: "Patient Ledger (Ctrl+L)"**
- Toolbar: Post Pay, Notes, Notes, (alert icon), (warning icon), All Notes, Print, Remove, Pat, Prvw Elec, Summary, Settle, Scan, Find, Pend Calls, New Call, Toggle Cycle, Close.
- Header: Patient ID [REDACTED] + provider initials, Name [REDACTED - test patient], Coverage (WC), Prim Id [REDACTED], PT-Share-Balance, Balance; Sort By (SERV DATE dropdown), Primary Ins (PROCARE), Insured, Phone; Zoom to (calendar), Secondary (NONE), Tertiary (NONE), DOB [REDACTED], Bill Prv; Notes; Show Deleted Items checkbox.
- Grid columns: Post Date, Serv Date, Code, Description, Dct, Fd, Ast, Rfd, Qty, Pt Amnt, Pt Total, Amount, Total.
- Example rows (test account) show the color coding: Insurance header row (blue) "PROCARE"; Claim Data (pink) with dx codes [REDACTED]; charge lines (yellow): E0666 NU "NON SEGMENTAL PNEU HALF" 250.00, E1399 RR "PNEUM COLD COMPRESSION UNIT" qty 30, 3150.00 (running total 3400.00); "Prm Claim 3400.00 PROCARE" (white); Payment (green) 0.00; Writeoff (red) -3400.00 "TEST CLAIM", ending balance 0.00.
- ALERT popup: title "ALERT", body shows timestamp + user initials ("14:12:59 09/02/26 [initials]"), buttons OK, Find, Date, Notes, Cancel, Print.
- Print dialog: Print, Print Preview, Save Parameters, Cancel; Dates (Leave empty for All) From/To (calendar); Order By (OPEN ITEM/SERV DATE dropdown); Patient Options: Sort By Patient Name (checked), Sort By Parent No; Patient (search); Billing Provider (search).
- Financial Summary: Print, Print Preview, Cancel. "Aged by Service date": buckets 1-30, 31-60, 61-91, 91-120, 121+ days; rows Total, Patient. "Main Account": Charges, Payments, Writeoffs, Refunds, Adjustments, Prim Billed; rows Total, Adjustment, Grand Total (example: charges 3,400.00, writeoffs 3,400.00, prim billed 3,400.00). "Patient Account": Charges, Payments, Writeoffs, Refunds, Adjustments; rows Total, Adjustment, Grand Total.

## CHARGE ENTRY (screenshots 6-10)

**Spec sheet (user-written):**
- A1 is "**wnds shift s** SCR19108". This looks like a leftover note/patient ID, not a header (guess). Column headers: B MANUAL ENTRY?, C AUTO POPULATES?, D SHORT CODE?, E NUMBER OF CHARACTERS, F MULTIPLE FIELDS?, G DROP DOWN?, H SEARCH OPTION?, I CALENDAR OPTION?. **No Y/N values are filled in for any row in rows 100-219.**
- Rows 100-101: "ENTER CODE, DESCRIPTION POPULATES INTO DESCRIPTION BOX. A-L DX CODES ALLOWED"
- Row 102: "BOTTOM OF SCREEN INDICATES DATE ENTERED, BY WHOM (USER INITIALS), DATE MODIFIED, MODIFIED BY WHOM (USER INITALS)"
- Row 104: **FRONT SCREEN**. Row 126: **BACK SCREEN**. Row 147: **PRINTING CLAIM:**. Row 164: DETAIL:. Row 177: ERRORS:. Row 191: PARAMETERS:. Each is followed only by a pasted screenshot; no extra spec text.

**Old system: FRONT SCREEN = "Service Lines Posting (Ctrl+K)"**
- Toolbar: Ok, Post Pay, Chart, Prs, Recall, Calc, Ledger, Patient, Alert, Warning, Print Lines, Print Image, Scan, Find, Cancel.
- Header: Patient ID, Name, Coverage (WC), Fee Schedule, PT-Share-Balance, Balance.
- Service Dates (from/to calendar), Prv, Fcl, Bill Prv, Asst, Ord Dr, Ord No (all search), Batch#, SupBill#, Cycl, Max, Post-Op Days (calendar).
- Claim, List buttons; PAN, Expires (calendar), Prm Ins; Sec Ins, Tertiary Ins (search). "?" help and "Clear ICDs" button.
- Diagnosis Codes A- through L- (12 slots, each with search) + Descriptions (yellow, auto-filled).
- Panel (search). Line grid: Order, Procedure (search), Modifiers/Desc (4 modifier searches), Diag Ptr, Select Ins to bill as Primary (dropdown), Claim, Rem, Qty, Patient Share, Price. Lines 01-05 visible.
- Footer: Date Entered, Time, By Whom, Date Modified, By Whom.

**Old system: BACK SCREEN = "Edit Claim Data"**
- Toolbar: Ok, Print, Clear Data, Patient, Ledger, Cancel.
- Tabs: Illness Info, Institutional (Electronic & UB-04) Info, Ambulance Info, Supplemental Info, Drugs-Competitive Acquisition Program (CAP).
- Illness Info fields: Pat Id, Serv Date (calendar), List, Prv, Fcl; PAN, PAN Expires, Reported in "Other Date", Bx:15 Other Date, Initial Treatment; Onset of Illness, Reason for Visit, Hearing/Vision Rx; Accident/Employment/Related Causes (dropdown), Bx:10d, Accident (state), Issue Date of the B/C (guess, from OCR), X-Ray; Delay Reason (dropdown), Acute Manifestation; Note Ref Code (dropdown), Claim Notes button; Referral No, Referral Date, Last Seen Date (DTP01), Clinical...
- Ordering: Ord Dr, Ordering Prv, Supervising Prv, "Report Prv in box 17 of CMS-1500".
- Work Related: Date Last Worked, Disability Start Date, Disability End Date, Date return to work (from OCR); Claim/Appeal Code (dropdown), Bx:10d, Freq/Resubmission Code, Original... (cut off).
- Height(in), Weight(lb), Anesthesia ASA (dropdown), ICD10 Search.
- Diagnosis Codes A-L + Description.
- Footer: Entered (date), By Whom, Date Modified, By Whom.

**Old system: PRINTING CLAIM = "Copy of Primary Claim Form for One Patient"**
- Toolbar: 1)Preview, 2)Print/Fax & tag charges, 2)Email & tag charges, 2)Export to Text & tag charges, Just View, Save Params, ?, Close.
- Note on screen: "Include all the Service Lines that their "Claim" field is set to "P"".
- Patient Id; Print on (Blank Paper dropdown); "Leave empty for all" - Billing Provider, Prv, Fcl, Asst, Payer; Posting From/To, Service From/To, Previous Claim Date.
- Tabs: Summary (cols Pat Name, Pat Id, Ins Name, Totals, Primary Id), Details (cols Pat Name, Pat Id, Serv Date, Dr, Fcl, Ref, Procedure, QTY, Price, Icd1, Icd2...), Errors (cols Bill Prv, Ins Name, Pat Name, Pat Id, Serv Date, Dr Id, Primary Id, Error Message), Claims Parameters.
- Claims Parameters: Top Margin (0.46), Left Margin (0.19), Top Margin of Insurance Address (1), Sort By (Insurance Name); checkboxes: Check for errors during Previewing of claims (checked), Print amount paid by patient on Box #29 (posted in line item) (unchecked), Print Procedure descriptions (checked), Include zero-amount charges (state unclear).

## PAYMENT POSTING (screenshots 11-15)

**Spec sheet (user-written):**
- A1 again "**wnds shift s** SCR19108"; same column headers as CHARGE ENTRY (B-I, MANUAL ENTRY? ... CALENDAR OPTION?). **No column values are filled in for the rows shown.**
- Row 68: **FRONT SCREEN (BULK POSTING)**
- Row 97: **BACK SCREEN (LINE ITEM POSTING, ALLOWS 20 LINES)**
- Row 119: **PAT SHARE DROP DOWN:**
- Row 129: **PRINT STATEMENT DROP DOWN:** (the screenshot does not show the list open, so its options are not visible)
- Rows 140-141: **WRITE OFF DROP DOWN (CAN MANUALLY ENTER DIFFERENT REASON)**

**Old system: FRONT SCREEN = "Payments & Writeoffs Posting (Ctrl+P)"**
- Toolbar: Ok, Ledger, Patient, Calc, Alert, Warning, Print, ?, Cancel.
- Header: Patient ID, Name, Coverage, PT-Share Balance, Balance.
- Service Dates (From-To) with calendars, Deposit Date (calendar), Prv, Fcl, Bill Prv, Asst, Batch # (search, "+").
- Payer (defaults to the patient name in the example), Payment Type (CHECK); Check No; Claim Ctrl No; PT Share Desc (dropdown); Writeoff Type (dropdown).
- Print Receipt? (N), Print Statement? (dropdown); Apply payment to PT-Share Balance? (Y); Apply writeoff to PT-Share Balance? (N).
- Amount row: BILLED (250.00, read-only), APPROVED, DEDUCTIBLE, PAYMENT, PAT SHARE, WRITEOFF.
- Line Item Posting (button), Statement Notes.
- Footer: Date Entered, Time, By (user initials, e.g. [initials]), Date Modified, By Whom.

**Old system: BACK SCREEN = "LINE ITEM POSTING"**
- Toolbar: Ok, ?, Pat Statement, Calc, Cancel.
- Grid columns: Post Date, Serv Date, Procedure, Billed, Approved, Status, Payment, Pat Payment, Writeoff, Residual. Example line: E0666 NU, billed 250.00, status DENIED, writeoff -250.00.
- Below grid: Review Reason; Sec Payment, Sec Writeoff; Adj code1 (dropdown), Adj Group (dropdown), Adj code2 (dropdown), Adj Group2 (dropdown), Other Payment.

**PT Share Desc dropdown options (old system):**
1-CO-INSURANCE, 2-CO-PAYMENT, 3-DEDUCTIBLE, 4-DENIED, 5-NON-COVERED SERVICE, 6-PAT RESPONSIBILITY, 7-NO INSURANCE COVERAGE

**Writeoff Type dropdown options (old system):**
1-PRIVATE INS WRITEOFF, 2-MEDICARE WRITEOFF, 3-MEDICAID WRITEOFF, 4-MEDI/MEDI WRITEOFF, 5-WORKERS COMP WRITEOFF, 6-CASH ADJUSTMENT, 7-COURTESY DISCOUNT, 8-BAD DEBT WRITEOFF, 9-PPO WRITEOFF, A-HMO WRITEOFF, B-HMO WITHHOLD, C-CHARGE REVERSAL, D-OTHER WRITEOFF, E-DENIED WRITEOFF, F-VSP WRITEOFF (OCR read "USP"; the image reads "VSP"), G-PI WRITEOFF, H-CHAMPUS WRITEOFF, I-MEDICARE FFS WRITEOFF, J-COLLECTION FEE WRITEOFF, K-MEDICARE 2% WRITEOFF, L-Office Collections, M-Less than $5, N-Insurance Disallowance, O-Administrative Adjustment, P-Credit Card Writeoff

## FILE MENU (screenshots 16-21)

**Spec sheet (user-written):**
- A1 "FILE:". This tab has no MANUAL ENTRY?/etc. columns; it is section labels plus pasted screenshots.
- Row 18: **EDIT COMPANY & OPTIONS** (screenshots only)
- Row 36: **PORTAL OPTIONS:** (screenshot only)
- Row 55: **PORTAL ONLINE APPT DOC:** = "PDF" (col D)
- Row 57: **PORTAL NEW PAT REG DOC:** = "PDF" (col D)
- Row 59: **TUTORIAL MENUS:** = "DROP DOWN" (col D)
- Row 72: **USERID/PASSWORD:**
- Rows 73-79: "TOOLS TO ADD, REMOVE, OR EDIT STAFF USERS. THE TABBED OPTIONS ALLOW US TO SELECT WHAT ACCESS TO GIVE EACH EMPLOYEE, AS MANAGEMENT. WE ONLY USE USER ID, USER NAME, PASSWORD, VERIFY PASSWORD, DATE CHANGED, THEN THE TABBED SETTINGS."
- Rows 90-91: **EDIT USER:** "EXACTLY THE SAME AS ADD USER. DIFFERENCE IS THE ABILITY TO CHANGE THE SETTINGS/FUNCTIONS OF AN EXISTING USER."
- Rows 94-96: **LIST USER/PASSWORDS:** "DISPLAYS ALL PREVIOUS, AND ACTIVE UERS [sic]. INCLUDES USER ID, USER NAME, USER TYPE, EMERGENCY ACCESS, INACTIVITY TIMEOUT, DR, FAC & DATE DEACTIVATED"

**Old system: File menu (Practice Expert Version 2018)**
- Top menu bar: File, Pat, Tran, Sch, EHR (more cut off).
- File menu items: Edit Company & Options; Portal Options; Portal Online Appointment Doc; Portal New PatRegistration Doc; Tutorials Menu >; UserID/Password >; Purge Menu >; Import from HL7 to Calmed; Import from HL7 to Calmed Doc; Import/Export to EMR Menu >; Import from text to Calmed Menu >; Installation Menu >; Check System Installations; API User List; Printer Setup; Exit (Alt+F4).

**Old system: "Edit Company & Options"**
- Toolbar: Ok, ?, Email, Cancel. Tabs: Company, Provider, Misc Options, Patient/Scheduling Options, Transactions Colors, HL7 Import/Export Options.
- Company tab: Company ID ("SCORE"), Company Name ("CALIBER DME BILLING, LLC"); Administrator Info: Clinic ID, Last [REDACTED], First [REDACTED], MI [REDACTED], Street [REDACTED], City/State/Zip [REDACTED], Phone [REDACTED], Fax [REDACTED]. Footer: Date Modified, By Whom (initials).
- Provider tab: Practice Type ("DME"), Tax ID [omitted], Same as Company Address checkbox, Provider Name ("RAM/SOUTHERN CA ORTHOPED REHAB"), Street/City/State/Zip [business address omitted, San Diego CA], Phone, Fax, Electronic Parameter ID (Leave empty if Elec Parameters are same in each data base).
- Misc Options tab (checked = [x]):
  - [ ] Do not Check for duplicate new patients using Name & Birthdate
  - [x] Use the new CMS-1500 form
  - [x] Allow Charge/Payment posting for future dates
  - [ ] At Login keep the Current Posting date same as the last Login date
  - [ ] When posting payments from ledger start at "Payment Type:" rather than "Payor:"
  - [ ] Enable global patient search across all databases
  - [ ] Enable global Electronic billing across all databases
  - [x] Disable Messaging & Dashboards
  - [ ] (greyed) Send Lab Orders/Receive Lab results from Quest Diagnostics
  - "The following options are used in "Service Lines Posting (Charges)" screen:"
  - [ ] Maintain the same Service date when posting Service lines
  - [x] Automatically Create New "Claim Data" when posting "Service Line" for a new date of service and the claim data is changed
  - [ ] Create New "Claim Data" and clear it when posting "Service Line" for a new date of service
  - [x] Automatically copy Referring Physician ID from Patient Registration to Service Line Screen
  - [ ] Automatically copy Assisting Doctor ID from Patient Registration to Service Line Screen
  - [ ] Perform full correlation between the procedure codes and diagnosis codes
  - [ ] Able to edit charges and change patient Share after Day is closed
  - [ ] Show Received Date in Charge screen
  - [ ] Track Product Inventory
  - [x] if "Maintain Separate Ledger:" is set to "Y" and "Claim" is set to "N" then copy Procedure Price to Patient Share
  - Default Provider, Default Facility ("H"), Default Assistant, Default County Code; Export Path+Filename; Import Path(+Filename); NPI of Billing providers (used for Electronic remittance advice): several values [omitted].

**Old system: "Portal Options"** (Save, Close)
- MSG: [x] Can Send Msg To Clinic, [x] Can Reply To Clinic
- APP: [ ] Appointments, [ ] Reminders
- APP LIMITS: Maximum No of total Appointments Allowed: 15; Maximum No of future days to make Appointments: 60
- PAT: [ ] Demographics, [ ] Charges/Payments, [ ] Family History, [ ] Social History, [ ] Medical History
- RECS: [ ] Open Notes (Federal Mandate), [ ] Clinical Summary, [ ] Transmit Information, [ ] Audit Log
- MISC: [ ] Can Add Representative

**Old system: Tutorials Menu sub-menus**
- Tutorials Menu > Update/Install Menu, Electronic Menu, Office Ally Menu, CMS-1500 Menu, UB-04 Menu, Data Menu, Capitation Document.
- Update/Install Menu > How to update your computer with the latest version of Practice Expert from Cal-med web site; How to Install a new Practice Expert database; How to Install Practice Expert on a Computer Connected to CalMed's Server thru Internet; How to Install Practice Expert on a Computer connected to your local area network; How to Install Practice Expert's "Xerexserver.exe" on your Computer.
- Electronic Menu > How to set one Insurance Company to be billed using NPI; How to set all Insurance Companies to be billed using NPI; How to Generate Medicare Secondary Claims; How to Set Up Practice Expert to Bill Mammography Services to Medicare; How Competetive Acquisition Program participants bill Medicare for Drugs; Anesthesia Billing.
- Office Ally Menu > How to Register with Office Ally; How to setup a Payer to be billed Through Office Ally; How to setup Electronic Parameters for Office Ally; How to Preview, Generate, and upload to Office Ally web site.
- CMS-1500 Menu > How to Print New Primary Claim Form; CMS-1500 Form General Instructions; CMS-1500 Form Medicare Instructions; How to set one/all Insurance Companies to be billed using NPI; How to Set Up So the Mammography Certificate # to appear on box 23; How to Set Up So the Prescription # for CAP to appear on box 19; Anesthesia Billing.
- UB-04 Menu > NDC Billing.
- Data Menu > (sub-items cut off; OCR suggests "MR Transaction/Registration in Dual Scheduling" (guess)).

**Old system: UserID/Password sub-menu**
- Add a New User/Password; Edit/Display User/Password; Delete User/Password; List Users/Passwords; Admin Settings.

**Old system: "Add New User"** (Save, Close)
- User ID, User Name, Password, Verify Password, Changed; [ ] User Approves Admin's Permission to Ready to Sign/Sign EPCS; User Role (dropdown), Has Emergency Access, Inactivity Timeout (Minutes), Deactivation Date (calendar); Supervising Provider (search); Primary Facility associated with this User (search); Direct Address, eFax No; Two factor authentication Phone, Two factor authentication Email.
- Tabs: EMR, Transactions/Registeration, Billing, Data, Scheduling.
- EMR tab: Normal Access list (Prescribe medication, Refill medication, Summary/Chart, History, HPI, Narrative, VitalsChart, Vitals, GrowthChart, AuditLog, Letters, Orders, Vaccination, Assessement and Office Procedures, Plan, SuperBill, Exam, ROS, plus drug-interaction/CDS/EPCS items); Emergency Access (same list); Patient Portal Access (Can Send Messages to Patient Portal, Show All Received Messages from Patient Portal on this User's Dashboard).
- Transactions/Registeration tab (all checked except Can change Patient Email): Can change Patient ID?, Can change Patient Email?, Can delete scanned image/picture?; Registration Menu? > Register New Patient?, Edit existing Patient?, Patient Label?, Notes for one Patient?, Delete one Patient?, Set First Patient ID #?, Patient Purge?, Automatically display patient Waring Remarks, Automatically disaplay patient Alert Remarks; Transactions? > Can Delete From Ledgers?, Daily Activity Ledgers?, Patient Ledgers?, Charges Posting?, Payments & Writeoffs?, Adjustment Posting?, Refunds Posting?
- Billing tab: Electronic Claims?, Query & Recall Letters?, Word Processing?, Reports Menu?, Billing?, Imaging?, Maintenance?, Insurance Paper Claims?, Statements? (all checked)
- Data tab (all checked): Data Directories, Assisting Doctor Menu, Attorney Menu, Collection Agency Menu, Coverage Menu, Diagnosis Menu, Employer Menu, Facility Menu, Insurance Menu, Notes Menu, Procedure/Modifier/Fee Schedule/Panel, Product Inventory Menu, Provider Menu, Referring Person Menu, Referring Phisician Menu, Rolodex Menu, Zip Code Menu.
- Scheduling tab (all checked): Appointment & Scheduling?, Can Create/Modify Templates, Can Make Non-Patient Appointments, Can overbook Appointments, Can Schedule on Blocked Time.
- List Users/Passwords window: Add, Edit, Delete, Close buttons (partially visible, #20).

---

## FILE MENU (screenshots 22-24)

### Spec notes written in the sheet
- **CAPTIATION DOCUMENT: PDF** (cell around AG60, to the right of the old-system menus; sic, "Captiation"). It sits next to the old "Capitation Document" menu item, so the note probably means that item is a PDF document (guess).
- **EDIT USER:** "EXACTLY THE SAME AS ADD USER. DIFFERENCE IS THE ABILITY TO CHANGE THE SETTINGS/FUNCTIONS OF AN EXISTING USER." (rows 90-91)
- **LIST USER/PASSWORDS:** "DISPLAYS ALL PREVIOUS, AND ACTIVE UERS [sic]. INCLUDES USER ID, USER NAME, USER TYPE, EMERGENCY ACCESS, INACTIVITY TIMEOUT, DR, FAC & DATE DEACTIVATED" (rows 94-96)
- **ADMIN SETTINGS:** (row 100; no text in col A, only a pasted old-system screenshot)
- **\*\*UNUSED FEATURES:** (rows 111-120)
  - IMPORT FROM HL7 TO CALMED
  - IMPORT FROM HL7 TO CALMED DOC
  - IMPORT/EXPORT TO EMR MENU
  - IMPORT FROM TEXT TO CAL-MED MENU
  - INSTALLATION MENU
  - CHECK SYSTEM INSTALLATIONS
  - API USER LIST
  - PRINTER SET UP
  - `**` (closing marker, row 120)
- **EXIT:** "CLOSE OUT OF PROGRAM" (row 122)

### Old-system screens pasted in FILE MENU
- **Help sub-menus (screenshot 22).** The parent menu holds: Update/Install Menu, Electronic Menu, Office Ally Menu, CMS-1500 Menu, UB-04 Menu, Data Menu, Capitation Document.
  - Office Ally Menu: Register with Office Ally; setup a Payer to be billed Through Office Ally; setup Electronic Parameters for Office Ally; Preview, Generate, and upload to Office Ally web site.
  - CMS-1500 Menu: How to Print New Primary Claim Form; CMS-1500 Form General Instructions; CMS-1500 Form Medicare Instructions; How to set one Insurance Company to be billed using NPI; How to set all Insurance Companies to be billed using NPI; How to Set Up So the Mammography Certificate # to appear on box 23; How to Set Up So the Prescription # for CAP to appear on box 19; Anesthesia Billing.
  - UB-04 Menu: NDC Billing.
  - Data Menu: How to add a new Rendering Provider; How to add a new Billing Provider.
- **Add New User dialog (screenshot 22, two copies).**
  - Toolbar: Save, Close.
  - Fields: User ID; User Name; Password; Verify Password; Changed; checkbox "User Approves Admin's Permission to Ready to Sign/Sign EPCS"; User Role (dropdown); Has Emergency Access (checkbox); Inactivity Timeout (Minutes); Deactivation Date (date picker); Supervising Provider (search); Primary Facility associated with this User (search); Direct Address; eFax No; Two factor authentication Phone; Two factor authentication Email.
  - Permission tabs: EMR | Transactions/Registeration | Billing | Data | Scheduling.
  - Data tab checkboxes (all checked): Data Directories, Assisting Doctor Menu, Attorney Menu, Collection Agency Menu, Coverage Menu, Diagnosis Menu, Employer Menu, Facility Menu, Insurance Menu, Notes Menu, Procedure/Modifier/Fee Schedule/Panel, Product Inventory Menu, Provider Menu, Referring Person Menu, Referring Phisician Menu, Rolodex Menu, Zip Code Menu.
  - Scheduling tab checkboxes (all checked): Appointment & Scheduling?, Can Create/Modify Templates, Can Make Non-Patient Appointments, Can overbook Appointments, Can Schedule on Blocked Times.
  - Top of screenshot 23 (rows 85-86) shows the bottom of another, tiny permissions list, partly legible: "...Can Export Data", "Admin Permits User to Ready to Sign/Sign EPCS", "User Approves Admin's Permission to Sign EPCS" (guess, very small).
- **List Users/Passwords window (screenshot 23).** Buttons: Add, Edit, Delete, Close. Columns: User ID, User Name, User Type, Emergency Access, Inactivity Timeout, Dr, Fac, Deactivated. One data row is partly visible, with a staff user name and type [REDACTED].
- **Admin Setting window (screenshots 23-24).** Buttons: Save, Close. Each setting below is a numeric spinner set to 0:
  - Minimum password length (Put 0 for no limit)
  - Lock after how many unsuccessful logins (Put 0 for no lock)
  - Require password change after how many days (Put 0 for no change)
  - Can reuse password after how many days (Put 0 for no restriction)

---

## PAT MENU (screenshot 25)

### Spec rows in col A (rows 1-31). Only col A is visible; cols B-L are scrolled off, so no Y/N values.
1. REGISTER NEW PATIENT:
2. EDIT PAT REGISTRATION:
3. NOTES FOR ONE PATIENT:
4. MESSAGE TO PATIENT PORTAL
5. DELETE ONE PATIENT:
6. (blank)
7. PATIENT LIST QUERY:
8. **PATIENT LIST QUERY SPECS:**
9. ACTION OPTIONS:
10. OK
11. PARAMETERS (NEW, OPEN SAVE, ETC.{UNUSED FEATUR[E]...} (cut off)
12. CLEAR ALL FIELDS
13. CANCEL
14. \*\*DEMOGRAPHICS\*\*
15. FIRST PATIENT
16. LIST ALL PATIENTS
17. LAST PATIENT
18. EXT: (BILLING PROVIDER INITIALS)
19. CITY
20. STATE
21. ZIP CODE
22. COVERAGE
23. CLASSIFICATION:
24. FIELD PRINT STATEMENT?
25. IS A FAMILY ACCOUNT?
26. PRM INS: PRIMARY INSURANCE
27. PRM DR: BILLING PROVIDER/SERVICING PROVIDER
28. REFERRING DR
29. SKIP PATIENTS WITH NO EMAIL
30. HAS ALERT REMARKS
31. SEC INS: SECONDARY INSURANCE
32. (cut off) "...PATIENTS THAT PT IS EXEMPT FROM CLINICAL RE[PORTING]..." (guess)

### Old system: "Query Patients - Parameter9" dialog (three copies, one per tab)
- Toolbar: OK, Parameters (dropdown), Clear All Fields, Cancel.
- Tabs: Demographics | Transactions | Worker's Comp.
- **Demographics tab**
  - "Leave empty for All Patients": First Patient, Last Patient (both search fields). Query Type dropdown (value "List ALL patients"); hint "Use * , - , + to do partial Query."
  - Fields: Ext, City, State, Zip Code; Cov, Classification; Prm Ins, Prm Dr, Referring Dr; Sec Ins; Sup Ins, Emplyr; Fee Sch, Ref By.
  - Check boxes (note: "Check boxes that are grayed out are skipped from the query"): Field "Print Statement?" is checked; Is a FamilyAccount; Skip Patients with no Email; Has Alert Remarks; Skip Patients that "Pt is Exempt from Clinical & Mkt Reporting:" set to Yes; Has Warning Remarks; Skip Deceased Patients; Separate Patient Ledger; Sort by Zip Code.
  - Ranges: Range of Patient Age From/To; Sex; Patient First name; Range of Birth Days From/To; Birth Month; Range of Birthdates From/To; Registration Dates From/To; Authorization Dates From/To; CHDP Next Visit From/To; Have Appointment From/To With Doctor / Facility / App Status (dropdown); Assigned to collection From/To.
- **Transactions tab**
  - Fields: CyclMax; Range of Total Patient Balance From/To; Range of Patient Share Balance From/To; Last Charge Between Service Dates From/To; Has a Charge Between Service Dates From/To; Made Payment Between Dates From/To; Did Not Make Any Payments From/To.
  - Procedure Code1/2/3, CPT Classification, Modifier1, No of Days Between Recall.
  - Has ICD code / Or ICD Description; Range of Illness Service Dates From/To; Range of Illness/Injury Dates From/To.
  - Provider, Facility, Bill Prv, Referring Dr, Assisting Dr.
- **Worker's Comp tab:** Date Med-Legal Billed From/To; Anticipated Med-Legal Pay Date From/To; Date Treatment Billed From/To; Anticipated Treatment Pay Date From/To; Date of Injury From/To; Claim No; WCAB No; Applicant's Attorney; Def. Attorney.

---

## TRAN MENU (screenshots 26-30)

In col A the sheet lists section headers. Each header is followed by a pasted old-system menu, and some carry a note. The old "Tran" menu holds: Patient Ledgers Menu, Daily Activity Menu, Service Lines Posting Menu, Payments & Writeoffs Menu, Adjustments/Refunds Menu, TAR Menu, Quote Menu, Copy Billing Providers from Rendering Providers, Copy Billing Providers from Facilities, SQL2008 Integrity Test, SQL2012 Integrity Test.

| Row | Sheet section (col A) | Sheet note | Old-system sub-menu items |
|---|---|---|---|
| 1 | PATIENT LEDGERS MENU: | none | Patient Ledger (Ctrl+L); Line Item Posting Ledger (Ctrl+I); HMO Ledger; Service Lines Ledger; Payments Ledger; Writeoffs Ledger; Adjustments Ledger; Refunds Ledger; Statements Ledger; Print All Active Ledgers; Print All Ledger Remarks; Print All Alert Remarks |
| 16 | DAILY ACTIVITY MENU: | none | Detailed Daily Ledger (Ctrl+D); Charges Ledger; Payments Ledger; Writeoffs Ledger; Adjustments Ledger; Refunds Ledger; Insurance Claims Ledger; Statements Ledger; Day Sheet(Detail); Day Sheet(Summary); Payments Report by deposit date; Bank Deposit Ticket; Daily Activity Report; Employee Daily Productivity Report; Close POS shift; Close End of Day; Deleted Activity Report |
| 16 (col H) | EMPLOYEE DAILY PRODUCTIVITY REPORT: | none | Dialog with Print / Print Preview / Cancel buttons. Description: "This report provides you the number of transaction (i.e. charges, payments, etc) each employee entered into database". Fields: Posting Date From / To (example 09/01/26 - 09/14/26). A sample printed report (rows ~31-44) is headed "CALIBER DME BILLING, LLC", "Employee Daily Productivity Report", with client "RAM/SOUTHERN CA ORTHOPED REHAB EQUIPMEN[T]". Columns: User Id, User Name, Patients Registered, Charges, Charges Removed, Payments, Payments Removed, Writeoffs, Writeoffs Removed, Adjustments, Adjustments Removed, plus a Totals row. Staff rows: [REDACTED] |
| 45 | SERVICE LINES POSTING MENU: | none | New Illness/Claim; Service Lines Posting (Ctrl+K); Post Service Lines from EMR; From/To Service Lines Posting; Recurring Service Lines Posting; Repetitive Service Lines Posting; Cyclic Service Lines Posting; CHDP Service Lines Posting (Ctrl+Y); CHDP Fee Schedule; Industrial/Physical Service Lines Posting; Serialized Inventory Transactions; Print Patients Industrial/Physical Flow Sheets; (one item cut off); Set Service Line Claim Indicators from Fee Schedule |
| 67 | PAYMENTS & WRITE OFF MENU: | none | Payments & Writeoffs Posting (Ctrl+P); Line Item Posting (Ctrl+U); Multiple Provider Posting; Bulk Payments Posting (Ctrl+Z); Bulk Payments Ledger; Post Payments from Checkedin/out/Portal List |
| 82 | ADJUSTMENTS/REFUNDS MENU: | none | Adjustment Posting (Ctrl+J); Refunds Posting |
| 92 | TAR MENU: | UNUSED FEATURE | Post Treatment Authorization Request; Print TAR for One Patient; Print TAR for All Patients |
| 101 | QUOTE MENU: | UNUSED FEATURE | New Patient Quote; Patients Quotes List; Quotes Templates |
| 116 | COPY BILLING PROVIDERS FROM RENDERING PROVIDERS | UNUSED FEATURE | none |
| 118 | COPY BILLING PROVIDERS FROM FACILITIES | UNUSED FEATURE | none |
| 120 | SQL2008 INTEGRITY TEST | UNUSED FEATURE | none |
| 122 | SQL2012 INTEGRITY TEST | **"RUN UTILITIES", DONE EVERY MONTH PRIOR TO INVOICING. "SYNCS" DATA TO ENSURE FINANCIAL ACCURACY.** | none |

Keyboard shortcuts in the old system (from the menus): Ctrl+L Patient Ledger, Ctrl+I Line Item Posting Ledger, Ctrl+D Detailed Daily Ledger, Ctrl+K Service Lines Posting, Ctrl+Y CHDP Service Lines Posting, Ctrl+P Payments & Writeoffs Posting, Ctrl+U Line Item Posting, Ctrl+Z Bulk Payments Posting, Ctrl+J Adjustment Posting.

---

## SCH MENU (screenshots 31-32). The whole tab is marked unused.

| Row | Section | Sheet note | Old-system items |
|---|---|---|---|
| 1 | SCHEDULING MENU: | UNUSED FEATURE | Appointments Book (Ctrl+B); Schedule Patient Appointment (Ctrl+S); Schedule Non-Patient Appointment; General Appointments List (Ctrl+G); Patient Appointments List (Ctrl+A); Patient Appointments History (Ctrl+1); Non-Patient Appointments List; Eligibility List; Sign-In Sheet; Checked in/Checked Out List; Phone Reminder List; Assign Checkedin Patients to Exam rooms; Cancelled Appointments List; No Shows List; Waiting List; Appointment Mailing Labels; Appointment Letters/Post cards; Daily Activity Log; Doctor Productivity Report; Appointment/Charges/Payments Report; Referring Physician/Appointments Report |
| 16 | SUPERBILLS/PR2S/REGISTRATIONS MENU: | UNUSED FEATURE | Print Superbills; Print PR2 Reports; Print Patient Registrations; Print a Superbill on demand; Superbills/Charges Report; Set First Superbill Number |
| 25 | RECALL MENU: | UNUSED FEATURE | Schedule New Recall; Recall List; Recall Report; Cancelled Recall List; Recall Labels; Recall Letters/Post Cards; Phone Reminder List; Advance expired Recall dates by one month |
| 35 | DELIVERY MENU: | UNUSED FEATURE | Schedule New Delivery; Delivery List; Cancelled Delivery List; Delivery Labels; Delivery Letters/Post Cards |
| 46 | TEMPLATE SETUP MENU: | UNUSED FEATURE | Setup Appointment Template For a Day of a Week; Setup Appointment Template For a Specific Date |
| 53 | SCHEDULING DOCUMENTS: | [UN]USED FEATURE; col C: "FILE SAVED AS PDF" | none |

---

## EHR MENU (screenshot 33). The whole tab is marked unused.
- A1: **"ALL UNUSED FEATURES:"**
- Old EHR menu items: Doctor First Report, PR2, PR4 (Ctrl+H); Patient Summary Sheet; ERX: New Prescription; ERX: Refill Requests List; ERX: Prescription List; Assign Checkedin Patients to Exam rooms; Clinical Activities Log; Encrypt/Hash Data & send it to Recipient; Receive Data & Decrypt/Verify; Merge patient information from a duplicate chart into the original chart; Import SNOMED codes; Import LOINC codes.

---

## BILLS MENU (screenshots 34-39)

The old "Bills" menu holds: 1500 Health Claim Forms Menu, UB-04 Paper Claim Forms Menu, CHDP Paper Claim Forms Menu, Statements and Receipts Menu, Industrial Billing Menu, Worker Comp/PI Billing Menu, Claims Appeal Menu, Tracer Menu, Medi-Cal Claims Inquiry Menu, CMN Menu.

| Row | Section | Sheet note | Old-system items |
|---|---|---|---|
| 1 | 1500 HEALTH CLAIM FORMS MENU: | **None. Not marked unused, so in use (guess)** | New Primary Claim Form for One Patient (Ctrl+F); New Secondary Claim Form for One Patient; New Tertiary Claim Form for One Patient; Rebill Unpaid Primary Claim for One Patient; New Primary Claim Forms for All Patients; New Secondary Claim Forms for All Patients; New Tertiary Claim Forms for All Patients; Rebill Unpaid Primary Claims for All Patients; Copy of Primary Claim Form for One Patient; Copy of Secondary Claim Form for One Patient; Copy of Tertiary Claim Form for One Patient; Copy of Primary Claim Forms for All Patients; Copy of Secondary Claim Forms for All Patients; Copy of Tertiary Claim Forms for All Patients; General CMS-1500 Document; Preprinted "CMS-1500 Form" Ordering Information |
| 20 | UB-04 PAPER CLAIM FORMS MENU: | UNUSED FEATURE | New UB-04 Primary Claim Form for one Patient; New UB-04 Secondary Claim Form for one Patient; New UB-04 Primary Claim Forms for All Patients; New UB-04 Secondary Claim Forms for All Patients; Copy of UB-04 Primary Claim Form for one Patient; Copy of UB-04 Secondary Claim Form for one Patient; Copy of UB-04 Primary Claim Forms for All Patients; Copy of UB-04 Secondary Claim Forms for All Patients; UB-04 Guide; UB-04 Medicare Guide; Preprinted "UB-04 Form" Ordering Information |
| 35 | CHDP PAPER CLAIM FORMS MENU: | UNUSED FEATURE | New CHDP Primary Claim Form for one Patient; New CHDP Primary Claim Forms for All Patients; Copy of CHDP Primary Claim Form for one Patient; Copy of CHDP Primary Claim Forms for All Patients |
| 49 | STATEMENTS & RECEIPTS MENU: | SEE "STATEMENTS" TAB FOR ADDITIONAL DATA | Statement for One Patient (Ctrl+T); Statements for All Patients; Receipt for One Patient; Itemized Statement for One Patient; Itemized Statements for All Patients; Post Finance/Late Fee Charges; Preprinted "Statement Form" Ordering Information |
| 60 | INDUSTRIAL BILLING MENU: | UNUSED FEATURE | Employer Invoice; Copy of Employer Invoice; Employer Monthly Status Report; QME Evaluator's Findings Summary; QME Appointment Notification; QME Appointment Notification (Old version); QME/AME Declaration of Service; QME Request for Summary Rating Determination; QME Report Time Frame Extension Request; Application for Adjudication of Claim |
| 74 | WORKER COMP/PI BILLING MENU: | SEE "WORKCOMP" TAB FOR ADDITIONAL DATA | RFA Request for Authorization; Physician's Return-to-Work & Voucher Report; Employee's Disability Questionnaire; Proof of Service by Mail for One Patient; Proof of Service by Mail for All Patients; Court Hearing List; Petition For Payment; Petition For Benefits; Declaration of Readiness Letter; Notice & Request for Allowance of Lien - Original; Notice & Request for Allowance of Lien - Amended; Document Cover Sheet; Document Separator Sheet; Provider's Request for Second Bill Review; "For PR2 report use PR2 tab in the EHR screen" |
| 94 | CLAIMS APPEAL MENU: | UNUSED FEATURE | Claims Appeal For One Patient; Claims Appeal For All Patients |
| 108 | TRACER MENU: | UNUSED FEATURE | Primary Tracer For One Patient; Primary Tracer For All Patients; Secondary Tracer For One Patient; Secondary Tracer For All Patients |
| 122 | MEDI-CAL CLAIMS INQUIRY MENU: | UNUSED FEATURE | Claims Inquiry For One Patient; Claims Inquiry For All Patients |
| 135 | CMN MENU: | UNUSED FEATURE | Print blank CMN for One Patient; Print CMN for One Patient; Print CMNs for All Patients; Diabets [sic] physician Order |

In-use BILLS sections, inferred from the absence of an "UNUSED" note: 1500 Health Claim Forms, Statements & Receipts (see STATEMENTS tab), Worker Comp/PI (see WORKCOMP tab).

---

## STATEMENTS (screenshots 40-42)

Title (A1): **STATEMENT FOR ONE PATIENT (BILLS MENU)**
Header columns: B MANUAL ENTRY? | C AUTO POPULATES FROM PT SET UP? | D SHORT CODE? | E NUMBER OF CHARACTERS | F MULTIPLE FIELDS? | G DROP DOWN? | H SEARCH OPTION? | I CALENDAR OPTION? | J CAN MANUALLY CHANGE? (cut off). Columns past J are not visible.

Rows 3-15 are hidden behind the frozen header. Row 15 is partly visible as "DATE RANGE (LABEL)" (guess).

| Row | Field | Manual | Auto-pop | Short code | # chars | Multiple | Drop down | Search | Calendar | Can change |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 | GENEREATE [sic] STATEMENT FOR ALL OPEN ITEMS? | Y | N | N | 10 | N | N | N | N | Y |
| 17 | INCLUDE ACTIVITY AS OF (FROM TO DATE) | Y | N | N | 12 | Y | N | N | N | Y |
| 18 | SORT BY: (BAL FWRD/POST DATE OR OPEN ITEM/SERV DATE) | Y | Y | N | 24 | N | Y | N | N | Y |
| 19 | STATEMENT TEMPLATE | Y | N | N | 50 | N | Y | N | N | Y |
| 31 | FILTER THE STATEMENTS BY ENTERING DATA ON ONE OR MORE FIELDS - LEAVE EMPTY FOR ALL | (section note) | | | | | | | | |
| 32 | BILLING PROVIDER | Y | N | Y | 4 | N | N | Y | N | Y |
| 33 | PROVIDER | Y | N | Y | 4 | N | N | Y | N | Y |
| 34 | FACILITY | Y | N | Y | 4 | N | N | Y | N | Y |
| 35 | COVERAGE TYPE: | Y | N | Y | 4 | N | N | Y | N | Y |
| 36-37 | MIN NUMBER OF DAYS BETWEEN STATEMENTS (LEAVE EMPTY FOR ALL) | Y | N | N | 3 | N | N | N | N | Y |

**Old-system Statement Template dropdown (pasted screenshot, rows 20-30):**
- Currently selected value: STATEMENT_CREDITCARD_RUNNINGBALANCE.
- Options: STATEMENT_CALMED2; STATEMENT_CREDICARD_PREPRINTED; STATEMENT_CREDITCARD; STATEMENT_CREDITCARDVISAMC; STATEMENT_CREDITCARD_RUNBAL_VM; STATEMENT_CREDITCARD_RUNNINGBALANCE; STATEMENT_CREDITCARD_VM_ONLY; STATEMENT_ELECTRONIC; STATEMENT_ICD; STATEMENT_ICD_PREPRINTED; STATEMENT_ICD_RUNNINGBALANCE; STATEMENT_PREPRINTED_2COLUMN; STATEMENT_PREPRINTED_4COLUMN; STATEMENT_PREPRINTED_ALLIANCEBUSINES[S]; STATEMENT_PREPRINTED_POSCORP.
- Labels visible behind the dropdown: "Statement Template", "Filter the State[ments]", "Billing Provider:", "Statement Opti[ons]", "Min Number of Da[ys]", "Include all tra[nsactions]" (checked), "Print dunning..." (unchecked), "Print Provider..." (unchecked).

**ADDRESS/MESSAGES TAB:** (rows 39-43)
- CHECK BOXES:
  - USE BILLING PROVIDER NAME AND ADDRESS FROM TRANSACTIONS THAT APPEAR ON STATEMENT
  - USE THE FOLLOWING NAME & ADDRESS ON THE STATEMENT
  - "NAME AND ADDRESS AS IT SHOULD APPEAR ON FORM. UNSELECT IF FORMS ARE PRE-PRINTED OR IF YOU WISH TO USE ADDRESS SPECIFIED IN THE PROVIDER DIRECTORY."

**ANNOUNCEMENT/CUSTOMIZED, DUNNING MESSAGES** (rows 53+)
- **ANNOUNCEMENTS: FILLABLE BOX** (row 54). The pasted old-system "Announcements" text box contains business boilerplate. It introduces SCORE, Southern California Orthopedic Rehab Equipment, as a durable medical equipment company and says to contact the billing office at 209-586-1400 or email [business email omitted]. It gives hours as Monday-Friday from 8:00 AM to 3:00 PST. It also tells patients paying with an HSA card to call first and confirm the company can accept payment, and to make checks payable to "SCORE". Box buttons: OK, Find, Date, Notes, Cancel, Print.
- **CUSTOMIZED MESSAGES (APPEARS ON TOP PART OF THE STATEMENT)** (rows 66-67). Old-system box "Customized Message (Appears on top part of the statement):" with the text "PLEASE CONTACT OUR BILLING SERVICE AT 209-586-1400. IF YOU HAVE ANY QUESTIONS. THANK YOU." Same OK/Find/Date/Notes/Cancel/Print buttons.
- **30+ DAY DUNNING MSG** (row 84). Old-system box "30+ day dunning msg:" (empty in the screenshot).

---

## STATEMENTS (screenshots 43-47)

Cell A1 / formula bar on every screenshot reads: **STATEMENT FOR ONE PATIENT (BILLS MENU)**. The row 1 header columns are the standard ones (B-J).

### (a) Spec rows written in the sheet

| Row | Field (col A) | Content |
|-----|---------------|---------|
| 102 | 60+ DAY DUNNING MSG | (no column values; old-system screenshot pasted beside it) |
| 120 | 90+ DAY DUNNING MESSAGE | (screenshot beside) |
| 138 | 120+ DAY DUNNING MSG: | (screenshot beside) |
| 153 | FULL STATEMENT WINDOW: | (screenshot beside) |
| 169 | STATEMENT FOR ALL PATIENTS | col B text: "SAME OPTIONS AS FOR ONE PATIENT" |
| 171 | RECEIPT FOR ONE PATIENT | col B text: "SIMILAR OPTIONS AS ONE PATIENT, SEE SCREENSHOT" |
| 188 | ITEMIZED STATEMENT FOR ONE PATIENT | col B text: "SAME OPTIONS AS FOR ONE PATIENT" |
| 190 | POST FINANCE/LATE FEE CHARGES | section header; the column headers are repeated on rows 190-191 |
| 212 | PREPRINTED STATEMENT FORM ORDERING INFORMATION | col B text: "PDF DOC" |

POST FINANCE/LATE FEE CHARGES fields:

| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 192 | PREVIEW LATE FEES | N | N | N | 24 | N | N | N | N | N |
| 193 | PAT LEDGER | N | N | N | 12 | N | N | N | N | N |
| 194 | PRINT | N | N | N | 5 | N | N | N | N | N |
| 195 | REMOVE | N | N | N | 6 | N | N | N | N | N |
| 196 | CANCEL | N | N | N | 6 | N | N | N | N | N |
| 197 | LEAVE EMPTY FOR ALL PATIENTS: FIRST PATIENT | Y | N | Y | 24 | N | N | Y | N | Y |
| 198 | INCLUDE ACTIVITY THROUGH: | Y | N | N | 10 | N | N | N | Y | Y |
| 199 | COVERAGE | N | N | Y | 10 | N | N | Y | N | Y |
| 200 | LAST PATIENT | Y | N | Y | 24 | N | N | Y | N | Y |
| 201 | BILLING PROVIDER | Y | N | Y | 4 | N | N | Y | N | Y |
| 202 | APPLY FINANCE CHARGE OR LATEE FEES ON ACCOUNTS: (sic) | N | N | N | 24 | N | Y | N | N | N |
| 203-206 | (pasted old-system snippet, see below) | | | | | | | | | |
| 207 | PERCENTAGE FINANCE CHARGE | Y | N | N | 30 | N | N | N | N | Y |
| 208 | FIXED LATE FEE | Y | N | N | 7 | N | N | N | N | Y |
| 209 | MIN BALANCE FOR THE APPLICATION OF LATE FEES | Y | N | N | 7 | N | N | N | N | Y |
| 210 | SKIP IF THERE WAS A PAYMENT WITHIN LAST 30 DAYS (CHECK BOX) | Y | N | N | 1 | N | N | N | N | Y |

### (b) Old-system screens pasted in STATEMENTS

- **Dunning message editor**, one per bucket. Its button bar is: OK, Find, Date, Notes, Cancel, Print. These are the exact message texts. The phone number is the billing office's business line, not a patient's.
  - 60+ day dunning msg: "OUR RECORDS INDICATE YOUR ACCOUNT IS NOW OVER 61 DAYS PAST DUE. PLEASE REFER TO THE EOB YOUR INSURANCE SENT YOU. ALL DENIED, DEDUCTIBLE, OR CO-INSURANCE CHARGES ARE BILLED TO THE PATIENT. PLEASE SEND PAYMENT, OR CALL OUR BILLING OFFICE @ 209-586-1400, MONDAY-THURSDAY FROM 9-4. THANK YOU."
  - 90+ day dunning msg: same wording but "OVER 91 DAYS PAST DUE" and "MONDAY-FRIDAY FROM 8:00 AM-3:00 PM PST. THANK YOU."
  - 120+ day dunning msg: same wording but "OVER 120 DAYS PAST DUE" and "MONDAY-FRIDAY FROM 8:00 AM-3:00 PM PST. THANK YOU."
  - There is also a 30+ day dunning msg slot. Its text was not shown in this batch.
- **Old Bills menu** (behind the statement window):
  - Top level: 1500 Health Claim Forms Menu, UB-04 Paper Claim Forms Menu, CHDP Paper Claim Forms Menu, Statements and Receipts Menu, Industrial Billing Menu, Worker Comp/PI Billing Menu, Claims Appeal Menu, Tracer Menu, Medi-Cal Claims Inquiry, CMN Menu.
  - Statements and Receipts Menu submenu: Statement for One Patient (Ctrl+T), Statements for All Patients, Receipt for One Patient, Itemized Statement for One Patient.
- **STATEMENT FOR ONE PATIENT (CTRL+T)** window:
  - Toolbar: Print/Fax & Post to Ledger, Excel & Post to Ledger, Email/Save to File & Post to Ledger, Just Preview, Save Parameters, Ledger, Patient, Cancel.
  - Tabs: Ranges/Options, Address/Messages.
  - Address section:
    - Checkbox "Use Billing Provider name and address from transactions that appear on statement".
    - Checkbox (checked) "Use the following name and address on the statement". Its help text reads: "Name and address as it should appear on form. Unselect if forms are pre-printed or if you wish to use address specified in the Provider directory."
    - Fields: Corporation Name (two lines), Street Address, City/State/Zip Code, Phone Number, NPI, Employer Id No.
    - Sample values are the practice's own business: SOUTHERN CA ORTH REHAB EQUIP (SCORE), San Diego CA, 209-586-1400.
  - Announcement/Customized/Dunning Messages section: Announcements, Customized Message (Appears on top part of the statement), 30+ day dunning msg, 60+ day dunning msg, 90+ day dunning msg, 120+ day dunning msg.
- **RECEIPT FOR ONE PATIENT** window:
  - Toolbar: Print/Fax & Post to Ledger, Email/Save to File & Post to Ledger, Just Preview, Save Parameters, Ledger, Patient, Cancel.
  - Tabs: Ranges/Options, Address/Messages.
  - Patient Options: Patient lookup ([REDACTED], appears to be a test patient), Pat Statement Data button.
  - Help text: "the Receipt is used for patient share only. Please look at the Payment screen. If you did not put "Y" in "Apply payment to PT-Share Balance?" then the payment will not appear on the Receipt".
  - Date Range: Include Activity as of [date] To [date]. Sort By: OPEN ITEM/SERV DATE.
  - Receipt Template drop-down: RECEIPT, RECEIPT_CREDICARD_PREPRINTED, RECEIPT_PREPRINTED_2COLUMN, RECEIPT_PREPRINTED_POSCORP.
  - Filter the Receipt by: Billing Provider.
  - Receipt Options: Print Provider Tax ID No, Print Provider State License No, Print Last Payment Date and Amount (checked).
- **Finance charge snippet** (rows 203-206):
  - "Apply Finance Charge or Late Fee on accounts older than: [3 Month]". The drop-down options are 2 Month, 3 Month, 4 Month, 5 Month.
  - "Minimum balance for the application of late fees or finance ..."
  - Green note: "Procedure code 99999 is used to post the late fe[e] ..." (the rest is cut off).
  - Grid columns: Pat Name, Pat Id.

---

## WORKCOMP (screenshots 48-49)

Cell A1 reads **RFA - REQUEST FOR AUTHORIZATION SCREEN (BILLS MENU)**. Row 2 reads "EXAMPLE SAVED AS PDF".

### (a) Spec rows written in the sheet
| Row | Item | Note |
|-----|------|------|
| 1 | RFA - REQUEST FOR AUTHORIZATION SCREEN (BILLS MENU) | example saved as PDF |
| 16-17 | PHYSICIAN'S RETURN-TO-WORK & VOUCHER REPORT | UNUSED FEATURE |
| 19-20 | EMPLOYEE'S DISABILITY QUESTIONNAIRE | UNUSED FEATURE |
| 22-23 | PROOF OF SERVICE BY MAIL FOR ONE PATIENT | UNUSED FEATURE |
| 25-26 | PROOF OF SERVICE BY MAIL FOR ALL PATIENTS | UNUSED FEATURE |
| 28-29 | COURT HEARING LIST | UNUSED FEATURE |
| 31-32 | PETITION FOR PAYMENT | UNUSED FEATURE (guess; the row is cut off at the bottom) |
| ~40-41 | NOTICE & REQUEST FOR ALLOWANCE OF LIEN - AMENDED | UNUSED FEATURE |
| 43-44 | DOCUMENT COVER SHEET | UNUSED FEATURE |
| 46-47 | DOCUMENT SEPARATOR SHEET | UNUSED FEATURE |
| 49-50 | PROVIDER'S REQUEST FOR SECOND BILL REVIEW | EXAMPLE IN PDF |

Rows 32-39 were not captured. They likely hold Petition For Benefits, Declaration of Readiness Letter, and the Lien - Original row (guess, based on the old menu order).

### (b) Old-system screens pasted in WORKCOMP
- **Worker Comp/PI Billing Menu**: RFA Request for Authorization; Physician's Return-to-Work & Voucher Report; Employee's Disability Questionnaire; Proof of Service by Mail for One Patient; Proof of Service by Mail for All Patients; Court Hearing List; Petition For Payment; Petition For Benefits; Declaration of Readiness Letter; Notice & Request for Allowance of Lien - Original; Notice & Request for Allowance of Lien - Amended; Document Cover Sheet; Document Separator Sheet; Provider's Request for Second Bill Review; "For PR2 report use PR2 tab in the EHR screen". Sibling menus shown: Industrial Billing Menu, Claims Appeal Menu, Tracer Menu, Medi-Cal Claims Inquiry Menu, CMN Menu.
- **Request for Authorization for Medical Treatment (DWC Form RFA)**:
  - Toolbar: Save, New Authorization, Print, Print Preview, Close.
  - Header fields: Patient (search), Claim No, Date of Request (date picker), Previous Requests (drop-down), Requesting Provider (search).
  - Checkboxes: New Request; Resubmission - Change in Material Facts; "Check if the patient faces an imminent and serious threat to his/ health"; "Check if request is written confirmation of a prior oral request".
  - Code grids: "Click here to Add/Edit ICDs" (ICDs 1-10) and "Click here to Add/Edit Services" (CPTs 1-10).
  - The Patient search pop-up shows "Search by: NAME" with options Patient Name, Patient Id, Responsible Name, Alias, Primary Id, Phone, Birth Date, Chart Number.
- **WcSecondBillReview** (Provider's Request for Second Bill Review):
  - Toolbar: Save, Print, Print Preview, Help, Close.
  - Fields: Employee (lookup; shows [REDACTED] test patient), Provider (search).
  - Bill Information: Provider's or Claims Administrator's Bill Identification Number; Date Explanation of Review Received by Provider; Date.
  - Buttons: Add Services/Goods, Delete Services/Goods.
  - Grid columns: DateOfService, ServiceInDispute, IsServiceAuthorized, AmountBilled, AmountPaid, AmountInDispute, IsSupportingDocsAttached.
- **AddEditDisputedService**:
  - Toolbar: Save, Close.
  - Fields: Date Of Service (date picker), Service/Good In Dispute, Service/Good Authorized? (Yes/No), Amount Billed, Amount Paid, Amount Dispute, Supporting Docs Attached? (Yes/No), Reason For Request (memo).

---

## ELEC MENU (screenshots 50-51)

Cell A1 reads **THIS MENU IS FOR ELECTRONIC CLAIMS/ERA DOWNLOADS**.

### (a) Spec rows written in the sheet (col A, then the note in col C)
| Row | Item | Note |
|-----|------|------|
| 18 | NEW PRIMARY CLAIMS | RUN ALL NEW INITIAL ELECTRONIC CLAIMS |
| 19 | NEW PRIMARY CLAIMS FOR ALL DATABASES | UNUSED FEATURE |
| 20 | NEW SECONDARY CLAIMS | RUN ALL NEW SECONDARY ELECTRONIC CLAIMS |
| 21 | NEW SECONDARY CLAIMS FOR ALL DATABASES | UNUSED FEATURE |
| 22 | PREVIOUSLY GENERATED SECONDARY CLAIMS | UNUSED FEATURE |
| 23 | TRANSMIT GENERATED CLAIMS (837) TO RECEIVER | UNUSED FEATURE |
| 24 | DOWNLOAD MEDICARE OR DMERC REPORTS | UNUSED FEATURE |
| 25 | ELECTRONIC REMITTANCE ADVIVE (ERA835) (sic) | DOWNLOAD ELECTRONIC PAYMENTS FROM CLEARING HOUSE FILE USING MEDICARE EASY PRINT TO PRINT THE EOB'S |
| 27 | MEDICARE REMIT EASY PRINT MENU | UNUSED FEATURE |
| 36 | MEDI-CAL DHDP (PM-160) MENU (sic, CHDP) | UNUSED FEATURE |
| 45 | HEALTH NET CHDP (PM-160) MENU | UNUSED FEATURE |
| 53 | VIEW 277 FORMAT ANSI FILE | UNUSED FEATURE |
| 54 | VIEW 999 FORMAT ANSI FILE | UNUSED FEATURE |
| 55 | 5010 ELECTRONIC CLAIMS DOCUMENT | UNUSED FEATURE |

The sheet has no row for "Previously Generated Primary Claims(837)", although that item appears in the old menu.

### (b) Old-system screens pasted in ELEC MENU
- **Old menu bar**: Elec, Data, Calls, Imaging, Rep[orts].
- **Elec menu**: New Primary Claims(837); New Primary Claims(837) for all databases; Previously Generated Primary Claims(837); New Secondary Claims(837); New Secondary Claims(837) for all databases; Previously Generated Secondary Claims(837); Transmit Generated Claims(837) to Receiver; Download Medicare or DMERC Reports; Electronic Remittance Advice(ERA835); Medicare Remit Easy Print Menu ▸; Medi-Cal CHDP (PM-160) Menu ▸; Health Net CHDP (PM-160) Menu ▸; View 277 format ANSI File; View 999 format ANSI File; 5010 Electronic Claims Document; Crosswalk Electronic/Paper claims.
- **Medicare Remit Easy Print submenu**: Medicare Remit Easy Print from folder HIPAA835; Medicare Remit Easy Print User Guide; Downloading & Installing Easy Print onto a Local PC; Downloading & Installing Easy Print onto a Network; Uninstalling Medicare Remit Easy Print Software; Medicare Remit Easy Print Provider/Supplier Help.
- **Medi-Cal CHDP submenu**: Generate New Claims File, Generate Previous Claims File, Transmit claims to CHDP.
- **Health Net CHDP submenu**: Generate New Claims File, Generate Previous Claims File.

---

## DATA MENU (screenshots 52-63)

Cell A1 is blank. Rows 1-2 carry the standard column headers, and the headers are repeated at the start of the Billing Provider section (rows 47-48).

### Old Data menu (pasted, rows 3-28)
- Menu bar: Data, Calls, Imaging, Re[ports], Letters, Word, He[lp].
- Data menu items: Appointment Types Menu ▸, Assisting Doctor List, Attorney Menu ▸, Billing Provider Menu ▸, Collection Agency List, Coverage Menu ▸, Employer Menu ▸, Facility Menu ▸, Fee Schedule Menu ▸, ICD-9 Codes Menu ▸, ICD-10 Codes Menu ▸, Insurance Menu ▸, Law Firm List, Modifier Menu ▸, Notes Menu ▸, Panel Menu ▸, Procedure Menu ▸, Product Inventory Menu ▸, Rendering Provider Menu ▸, Referring Person List, Referring Physician Menu ▸, Rolodex Menu, Room Menu ▸, Serialized Product Inventory Menu, Zip Code List.

### Sections marked unused in the sheet
- Row 30: APPOINTMENT TYPES MENU, UNUSED FEATURE. The old submenu is Add a New Appointment Type, Edit/Display Appointment Type, Delete Appointment Type, List Appointment Type.
- Row 36: ASSISTING DOCTOR LIST, UNUSED FEATURE.
- Row 37: ATTORNEY MENU, UNUSED FEATURE. The old submenu is Add a New Attorney, Edit/Display an Attorney, Delete an Attorney, Mailing Label for Attorneys, List Attorneys.
- Rows 214-215: EMPLOYER MENU, UNUSED FEATURE. The old submenu is Add a New Employer, Edit/Display Employer, Delete Employer, Mailing Labels for Employers, List Employers.
- Rows 415-416: MANAGED CARE TAB (Insurance), UNUSED FEATURE.
- Rows 427-428: LAW FIRM LIST, UNUSED FEATURE.

### BILLING PROVIDER MENU (row 47), BILLING PROIVDER LOOP 2010AA TAB (row 48, sic), ADD NEW BILLING PROVIDER (row 49)
| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 50 | PROVIDER ID | Y | N | Y | 4 | N | N | Y | N | Y |
| 51 | GROUP NPI | Y | N | N | 10 | N | N | N | N | Y |
| 52 | TAXONOMY CODE | Y | N | N | 24 | N | N | N | N | Y |
| 53 | TYPE QUALIFIER (PERSON/NON PERSON) | Y | N | Y | 24 | N | Y | N | N | N |
| 54 | ORG/LAST NAME | Y | N | N | 50 | N | N | N | N | Y |
| 55 | FIRST NAME | Y | N | N | 50 | N | N | N | N | Y |
| 56 | MIDDLE INITIAL | Y | N | N | 2 | N | N | N | N | Y |
| 57 | (label cut off, ends in "...E", guess SUFFIX/NAME) | Y | N | N | 5 | N | N | N | N | Y |
| 58-102 | not captured | | | | | | | | | |
| 103 | (cut off, possibly STATE, guess) | Y | N | ? | 2 | N | N | N | N | Y |
| 104 | CONTACT | Y | N | N | 80 | N | N | N | N | Y |
| 105 | PHONE NUMBER | Y | N | N | 12 | N | N | N | N | Y |
| 106 | PRIMARY ID QUALIFIER | Y | N | Y | 2 | N | N | N | N | Y |
| 107-111 | old drop-down "Primary ID Qualifier": Employer's Identification Number; Social Security Number; HCFA National Provider Identifier | | | | | | | | | |
| 112 | PRIMARY ID | Y | N | N | 12 | N | N | N | N | Y |
| 113 | STATE LICENSE NO-0B | Y | N | N | 24 | N | N | N | N | Y |
| 114 | BLUE CROSS/STATE LIC-1A | Y | N | N | 24 | N | N | N | N | Y |
| 115 | BLUE SHIELD/ STATE LIC-1B | Y | N | N | 24 | N | N | N | N | Y |
| 116 | MEDICARE GROUP NO-1C | Y | N | N | 24 | N | N | N | N | Y |
| 117 | DMERC MEDICARE -1C | Y | N | N | 24 | N | N | N | N | Y |
| 118 | RAILROAD MEDICARE-1C | Y | N | N | 24 | N | N | N | N | Y |
| 119 | MEDICAID PIN-1D | Y | N | N | 24 | N | N | N | N | Y |
| 120 | UPIN NO-1G | Y | N | N | 24 | N | N | N | N | Y |
| 121 | CHAMPUS ID NO-1H | Y | N | N | 24 | N | N | N | N | Y |
| 122 | FACILITVLD NO-1J (sic, Facility ID) | Y | N | N | 24 | N | N | N | N | Y |
| 123 | PPO NO-B3 | Y | N | N | 24 | N | N | N | N | Y |
| 124 | HMO NO-BQ | Y | N | N | 24 | N | N | N | N | Y |
| 125 | EMPLOYER ID NO-EI | Y | N | N | 24 | N | N | N | N | Y |
| 126 | CLINIC NO-FH | Y | N | N | 24 | N | N | N | N | Y |
| 127 | COMMERCIAL NO-G2 | Y | N | N | 24 | N | N | N | N | Y |
| 128 | PROVIDER SITE NO-G5 | Y | N | N | 24 | N | N | N | N | Y |
| 129 | LOCATION NO-LU | Y | N | N | 24 | N | N | N | N | Y |
| 130 | SOC SEC NO-SY | Y | N | N | 24 | N | N | N | N | Y |
| 131 | UNIQUE SUPPLIER ID-U3 | Y | N | N | 24 | N | N | N | N | Y |
| 132 | ACCIDENT NO-X5 | Y | N | N | 24 | N | N | N | N | Y |

### COVERAGE MENU (row 146)
The old submenu is Add a New Coverage, Edit/Display a Coverage, Delete Coverage, List Coverages.

ADD A NEW COVERAGE (row 153):

| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 154 | COVERAGE TYPE | Y | N | Y | 7 | N | N | Y | N | Y |
| 155 | SHORT CODE | Y | N | Y | 7 | N | N | N | N | Y |
| 156 | COVERAGE COLOR | Y | N | N | 4 | N | N | N | N | Y |
| 157 | STANDARD COVERAGE TYPE | Y | N | N | 24 | N | Y | N | N | Y |
| 158 | CLAIM FILING INDICATOR | Y | N | Y | 12 | N | Y | N | N | Y |
| 159 | MAINTAIN SEPARATE PAT LEDGER | Y | N | N | 1 | N | N | N | N | Y |
| 160 | PRINT STATEMENT | Y | N | N | 1 | N | N | N | N | Y |
| 161 | FINANCE CHARGE | Y | N | N | 1 | N | N | N | N | Y |
| 162 | PRINT TRACERS | Y | N | N | 1 | N | N | N | N | Y |
| 163 | LATE FEE | Y | N | N | 1 | N | N | N | N | Y |
| 164 | PRINT DUNNING MESSAGES | Y | N | N | 1 | N | N | N | N | Y |
| 165 | PRIMARY INSURANCE | Y | N | Y | 12 | N | N | Y | N | Y |
| 166 | FEE SCHEDULE | Y | N | Y | 12 | N | N | Y | N | Y |
| 167 | CLAIM | Y | N | Y | 1 | N | N | N | N | Y |
| 168 | SECONDARY INSURANCE | Y | N | Y | 12 | N | N | Y | N | Y |
| 169 | FEE SCHEDULE | Y | N | Y | 12 | N | N | Y | N | Y |
| 170 | CLAIM | Y | N | Y | 1 | N | N | N | N | Y |
| 171 | DATE ENTERED (AUTO POPULATES FROM LOGIN DATE) | N | N | N | 10 | N | N | N | N | N |
| 172 | BY WHOM (AUTO POPULATES FROM LOGIN) | N | N | N | 4 | N | N | N | N | N |

More sheet rules for this section:
- Row 190: EDIT/DISPLAY A COVERAGE: "SAME OPTIONS AS "ADD A NEW COVERAGE"".
- Row 193: DELETE COVERAGE: "SAME OPTIONS AS "ADD A NEW COVERAGE"".
- Row 196: LIST COVERAGE: "LIST OF ALL MANUALLY ADDED COVERAGES".

**Old "Add a New Coverage" screen:**
- Toolbar: Ok, ?, Print, Cancel.
- Fields: Coverage Type, Short Code, Coverage Color (color picker), Standard Coverage Type (drop-down), Claim Filing Indicator.
- Note: "If you change this field then the corresponding field in all patient registrations that use this coverage will also change".
- Checkbox: Maintain Separate Pat Ledger.
- Note: "The following defaults are set only on New patient registrations".
- Default checkboxes: Print Statement (checked), Finance Charge, Print Tracers (checked), Late Fee, Print Dunning Messages (checked), "Capitated - Patient ID of Capitated Ledger" (disabled).
- Insurance fields: Primary Insurance + Fee Schedule + Claim; Secondary Insurance + Fee Schedule + Claim.
- Footer: Date Entered, By Whom.

**Old "Coverages List" screen:**
- Toolbar: Add, Modify, Delete, Filter, Print Preview, Print, Close.
- Columns: Coverage Name, Short Code, Coverage Type, Statement, Dunning, Pat Ledger, Primary Insurance Name, Secondary Insurance Name.
- Sample rows (Total: 14). These are payer/plan data, shown as coverage name (short code) followed by coverage type:
  - CASH (CASH): CASH
  - HMO: HMO
  - LIEN (LIEN): PI
  - MEDICARE DME (M): MEDICARE, primary DMERC REGION D OFFICE AL...
  - MVA: PI
  - PARTNERSHIP (PART): PPO, primary PARTNERSHIP HEALTH PLAN
  - PERSONAL INJURY (PI): PI
  - PPO (P): PPO
  - [REDACTED, possibly a person or firm name] (SA): WC
  - [REDACTED, possibly a person or firm name] (SCH): WC
  - TRICARE WEST (TW): PPO, primary TRICARE WEST
  - TRIWEST (T): PPO, primary TRIWEST
  - VA: OTHER, primary VA CCN OPTUM
  - WC (WC): WC

**Old Employer screens** ("Add a New Employer" and "Edit/Display Employer"; the sheet marks the Employer menu as unused):
- Toolbar: Ok, ?, Notes, Print, Email, Cancel.
- Fields: Name, Short Code, Addr1, 2, Zip, City, State, County, Phone, Fax, E-mail, Contact1, Contact2, Night Phone, Hours of Business, Nature of Business, No. of Employees, Referred by, Shifts, Modified Work (checkbox), Call Because of Job Classification (checkbox).
- Industrial/Physical Procedure Panels 1-8.
- Previous Insurance (Primary ID, Date Policy in Effect) and Current Insurance (Primary ID, Date Policy in Effect).
- Edit screen only: an "Update Patients" button.
- Footer: Date Modified, By Whom ([REDACTED user initials]).

### FACILITY MENU (row 228)
The old submenu is Add a New Facility, Edit/Display Facility, Delete Facility, Mailing Labels for Facilities, List Facilities.

ADD A NEW FACILITY (row 236), BILLING TAB (row 237), SERVICE FACILITY LOCATION (row 238):

| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 239 | FACILITY ID | Y | N | Y | 4 | N | N | Y | N | Y |
| 240 | SHORT CODE | Y | N | Y | 4 | N | N | N | N | Y |
| 241 | BILLING PROVIDER ID | Y | N | Y | 4 | N | N | Y | N | Y |
| 242 | SCHEDULE ANY DOCTOR IN THIS FACILITY (cut off) | Y | N | Y (guess) | 1 | N | N | N | N | Y |
| 243-288 | not captured | | | | | | | | | |
| 289 | CHAMPUS ID NO-1H | Y | N | N | 24 | N | N | N | N | Y |
| 290 | IND ACCIDENT NO-X5 | Y | N | N | 24 | N | N | N | N | Y |
| 291 | MAMMOGRAPHY CERTIFICATE | Y | N | N | 24 | N | N | N | N | Y |
| 292 | NETWORK ID/STATE LIC NO-N5 | Y | N | N | 24 | N | N | N | N | Y |
| 293 | IND ACCIDENT NO-X5 (repeated) | Y | N | N | 24 | N | N | N | N | Y |

Further sheet rows:
- Row 295: QUEST LAB TAB. The old screen has User Name, Password, Opera[tion].
- Row 300: LAB CORP TAB. The old screen has Sending Facility Id, Receiving Facility Id, Client Id, Operation (drop-down).
- Rows 309-310: EDIT/DISPLAY FACILITY, "SAME AS ADD A NEW FACILITY".
- Rows 312-313: DELETE FACILITY, "SAME AS ADD A NEW FACILITY".
- Rows 315-316: MAILING LABELS FOR FACILITIES, "CREATE LABELS ON INSTALLED COMPUTER PROGRAM".
- Rows 329-330: LIST FACILITIES, "LIST OF MANUALLY ENTERED FACILITIES".

**Old "Add a New Facility" screen** (small and partly legible):
- Tabs: Billing, Quest Lab, Lab Corp.
- SERVICE FACILITY LOCATION-Loop 2310C NM1 section:
  - Facility ID, Short code, Billing Provider ID, "Schedule any doctor in this facility?", App Book Color, Name, NPI.
  - Note: "Facility will not show in claims if this NPI is same as the Billing Provider NPI".
  - Inpatient Facility?
  - "Print Facility address on box 32 of CMS1500 form (set to Yes except when POS is either 11(office) or 12(home))?"
  - Outside Lab?
  - Place of service (POS) code for Professional Claims; Place of service (POS) code for Institutional Claims.
  - Fee Schedule; CLIA No ("Used for Medicare"); DirectAddr.
  - "Show in Portal" with the note "Set to Yes so this Facility is accessible from Patient Portal".
- 2 digits Place of Service code for part A: First Digit (Type of Facility), Second Digit (Except Clinics & Special Facilities), Second Digit (Clinics Only), Second Digit (Special Facility Only).
- Actual address used in EMR: Addr1, 2, Zip, City, State, County, Phone, Fax, SureScripts Location ID.
- Facility Secondary Identification used in Claims: State License No-0B, Commercial No-G2, Location/MinCalD-LU.
- Info used in Electronic/Paper claims (N3 & N4): Contact, Addr1, 2, Zip, City, State, Phone.
- Pre 5010: Primary ID Qual, Prim ID, Taxonomy Code, Identifier Code.
- Pre 5010 Legacy Numbers: Medicaid PIN-1D, Blue Cross PIN(1A), Blue Shield/State Lic No-1B, Medicare PIN-1C, DMERC Medicare PIN-1C, RailRoad Medicare PIN-1C, Fed Tax Id No-TJ, UPIN No-1G, CHAMPUS Id No-1H, Ind Accident No-X5, Mammography Certificate, Network Id/State Lic No-N5.

**Old "Mailing Labels for Facilities" screen:**
- Toolbar: Print, Print Preview, Close.
- Option: Include Phone Number.
- Template drop-down: AVERY5160_ADDR&PHONE, AVERY5160_ADDR, AVERY5160_BLANK, AVERY5160_QUICK, AVERY5161_ADDR&PHONE, AVERY5161_ADDR, AVERY5162_ADDR&PHONE, AVERY5162_ADDR, AVERY5163_ADDR&PHONE, AVERY5163_ADDR, AVERY5167_ADDR, AVERY5197_ADDR&PHONE, AVERY5197_ADDR, DYMO, DYMOSINGLE.
- Customize: Rows 10, Cols 3.

**Old "Facility List" screen:**
- Toolbar: Add, Modify, Delete, Filter, Print Preview, Print, Close.
- Columns: Name, ID, Short Code, Place, Address, City, State, Zip, Phone, Fax.
- Total: 6. These are business facilities, and their addresses were omitted. Names: DELTA BAY SURGICENTER (DB, POS 24), LWCC-VINE (L, POS 11), PATIENT'S HOME (H, POS 12), PRECISION SURGICENTER (PS, 24), SANTA ROSA AMBULATORY (SR, 24), plus a placeholder "AAAAAAAAAA".

### INSURANCE MENU (row 342)
The old submenu is Add a New Insurance Company, Edit/Display Insurance Company, Delete Insurance Company, Mailing Labels for Ins Companies, Mailing Labels for Adjustors, List Insurance Companies, List Insurance Adjustors, Convert all Insurances to ICD10, Convert all Insurances to ICD9, Import Quest Labs Insurance Codes.

ADD A NEW INSURANCE COMPANY (row 353), CARRIER INFO TAB (row 354):

| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 355 | PAYER | Y | N | N | 30 | Y | N | N | N | Y |
| 356 | SHORT CODE | Y | N | Y | 4 | N | N | N | N | Y |
| 357 | GROUP ID | Y | N | N | 24 | N | N | N | N | Y |
| 358 | PAYER TYPE | Y | N | N | 30 | N | Y | N | N | Y |
| 359 | COVERAGE TYPE | Y | N | Y | 12 | N | N | Y | N | Y |
| 360 | CLAIM OFFICE | Y | N | N | 30 | N | N | N | N | Y |
| 361 | COBA NO | Y | N | N | 12 | N | N | N | N | Y |
| 362 | PRIMARY PAYER ID | Y | N | N | 7 | N | N | N | N | Y |
| 363 | SECONDARY ID QUALIFIER | Y | N | N | 50 | N | Y | N | N | Y |
| 364 | SECONDARY ID | Y | N | N | 24 | N | N | N | N | Y |
| 365 | ELECTRONIC TYPE (I.E. MEDICARE, CLEARING HOUSE, ETC.) | Y | N | N | 30 | N | Y | N | N | Y |
| 366-413 | not captured | | | | | | | | | |
| 415-416 | MANAGED CARE TAB | UNUSED FEATURE | | | | | | | | |

**Old "Add a New Insurance Company", Managed Care tab:**
- Toolbar: Ok, ?, Label, Notes, Print, Email, Cancel.
- Tabs: Carrier Info, Managed Care.
- Fields: Managed Care checkbox, Administrator, Elig#, Review Organization, Phone, $Co-Payment, %Co-Payment.
- Buttons: Participating Physicians, Authorized Facilities, For Your Information, Co-Pay/Deductibles, Pre-Authorization, Claims Instructions.
- Footer: Entered date, By [REDACTED user initials].

**Old "Law Firm List (web version)":**
- Controls: + Add New, search box.
- Columns: Name, SC, Contact, Address, Addr2, City, St, Zip, Home Phone, W...
- The list was empty.

### MODIFIER MENU (row 436)
The old submenu is Add a New Modifier, Edit/Display Modifier, Delete Modifier, List Modifiers.

ADD A NEW MODIFIER (row 445):

| Row | Field | B | C | D | E | F | G | H | I | J |
|-----|-------|---|---|---|---|---|---|---|---|---|
| 446 | MODIFIER | Y | N | Y | 3 | N | N | Y | N | Y |
| 447 | DESCRIPTION | Y | N | N | 30 | N | N | N | N | Y |
| 448 | AUTOMATICALLY POST NOTE TO CHARGES | Y | N | N | 30 | N | N | Y | N | Y |

Further sheet rows:
- Rows 450-451: EDIT/DISPLAY MODIFIER, "SAME OPTIONS AS ADD A MODIFIER".
- Rows 453-454: DELETE MODIFIER, "SAME OPTIONS AS ADD A MODIFIER".
- Row 456: LIST MODIFIERS, with an old-system screenshot beside it.

**Old "Modifier List" screen:**
- Toolbar: Add, Modify, Delete, Filter, Print Preview, Print, Close.
- Columns: Name, Class, Description.
- Rows: 59 SEPARATE SERVICE; CG MEETS MEDICAL NECESSITY; GA WAIVER OF LIABILITY-ABN; GP PHYSICAL THERAPY CARE; GZ EXPECTED TO BE DENIED; KF FDA CLASS III DEVICE; KH PURCHASE OR FIRST MONTH; KR PARTIAL MONTH RENTAL; KX MEETS MED NECESSITY REQUI[REMENTS]; LT LEFT SIDE; NU PURCHASE ITEM; RR RENTAL ITEM; RT RIGHT SIDE; UE USED EQUIPMENT.

---

## DATA MENU (gid=1691826382), screenshots 64-78

### (a) Spec rows written in the sheet

#### Section headings and notes (row order)

| Row | Text in sheet | Note |
|---|---|---|
| 456 | LIST MODIFIERS | old-system Modifier List screenshot (see (b)) |
| 467 | NOTES MENU: | 468: **UNUSED FEATURE** |
| 470 | ADD A NEW NOTE | old-system "Add a New Note" dialog |
| 483 | PANEL MENU: | old-system menu screenshot |
| 493 | ADD A NEW PROCEDURE PANEL | field table below |
| 505 | LIST PROCEDURE PANELS | screenshot (list shows "Total 2") |
| 521 | REBUILD PANEL SEARCH | 522: **UNUSED FEATURE** |
| 524 | PROCEDURE MENU: | old-system menu screenshot |
| 534 | ADD A NEW PROCEDURE CODE | |
| 535 | PROCEDURE CODE TAB | field table below |
| 574 | NDC REPORTING TAB | 575: **UNUSED FEATURE** |
| 588 | ORDER TAB | 589: **UNUSED FEATURE** |
| 602 | RECALL/REMINDERS | (continues past this screenshot; whether it is marked unused is not confirmed) |
| 617 | EDIT A PROCEDURE CODE: | "SAME OPTIONS AS ADD A PROCEDURE CODE" |
| 620 | DELETE A PROCEDURE CODE: | "SAME OPTIONS AS ADD A PROCEDURE CODE" |
| 623 | LIST PROCEDURE SORT BY CODES | screenshot |
| 635 | LIST PROCEDURE SORT BY DESC | screenshot |
| 647 | INCREASE/DECREASE ALL PROCEDURE PRICES | old-system dialog |
| 655 | REBUILD PROCEDURE SEARCH | **UNUSED FEATURE** |
| 658 | BUILD AMA FILE | **UNUSED FEATURE** |
| 661 | PRODUCT INVENTORY MENU | 662: **UNUSED FEATURE** |
| 664 | ADD A NEW PRODUCT | old-system screen (see (b)); no field table |
| 678 | EDIT A PRODUCT | "SAME OPTIONS AS ADD A PRODUCT" |
| 681 | DELETE PRODUCT | "SAME OPTIONS AS ADD A PRODUCT" |
| 684 | LIST PRODUCTS BY DESCRIPTION | screenshot shows "No Data" |
| 694-697 | LIST PRODUCTS BY CODE / LIST PRODUCTS TO BE REORDERED / LIST TAXABLE PRODUCTS / LIST SERIALIZED PRODUCTS | headings only |
| 699 | RENDERING PROVIDER MENU: | old-system menu screenshot |
| 709 | ADD A NEW RENDERING PROVIDER: | |
| 710 | BILLING TAB: | field table below |
| 775 | EHR ICD9S TAB | 776: "**OUTDATED & UNUSED FIELD, ICD 9'S DON'T APPLY**" |
| 787 | EHR PROCEDURES TAB | 788: **UNUSED FEATURE** |
| 800 | EHR MEDICATIONS TAB | 801: **UNUSED FEATURE** |
| 815 | REFERRING PERSON LIST | 816: **UNUSED FEATURE** |
| 827 | REFERRING PHYSICIAN MENU: | old-system menu screenshot |
| 838 | ADD A NEW REFERRING PHYSICIAN | field table below |
| 887 | DELETE REFERRING PHYSICIAN | "SAME OPTIONS AS ADD A NEW REFERRING PHYSICIAN" |
| 890 | MAILING LABELS | "CREATE LABELS ON INSTALLED COMPUTER PROGRAM" |
| 904 | LIST REFERRING PHYSICIANS | screenshot of the physician list (contents redacted) |
| 916 | REBUILD REF DOCTOR SEARCH | 917: "…USED FEATURE" (the first letters are hidden by an overlay; almost certainly "UNUSED FEATURE" (guess)) |

#### Field tables (read from the images)

Columns: Manual | Auto-pop | Short code | # Chars | Multiple | Drop down | Search | Calendar | Can change

**ADD A NEW PROCEDURE PANEL** (screenshot 65)

| Row | Field | Man | Auto | SC | Chars | Mult | DD | Search | Cal | Can chg |
|---|---|---|---|---|---|---|---|---|---|---|
| 494 | PANEL NAME | Y | N | N | 12 | N | N | Y | N | Y |
| 495 | SHORT CODE | Y | N | Y | 4 | N | N | N | N | Y |

(Rows 496-504 are not captured in this batch.)

**ADD A NEW PROCEDURE CODE: PROCEDURE CODE TAB** (screenshot 67)

| Row | Field | Man | Auto | SC | Chars | Mult | DD | Search | Cal | Can chg |
|---|---|---|---|---|---|---|---|---|---|---|
| 536 | PROCEDURE CODE | Y | N | N | 7 | N | N | N | N | Y |
| 537 | SHORT CODE | Y | N | Y | 7 | N | N | N | N | Y |
| 538 | DESCRIPTION | Y | N | N | 80 | N | N | N | N | Y |
| 539 | PRICE (AUTO POPULATES DOLLARS & CENTS) | Y | N | Y | 12 | N | N | N | N | Y |
| 540 | RENTAL PRICE (AUTO POPULATES DOLLARS & CENTS) | Y | N | Y | 12 | N | N | N | N | Y |
| 541 | OUTSIDE LAB CHARGE | Y | N | Y | 12 | N | N | N | N | Y |
| 542 | PERFORMANCE COST | Y | N | Y | 12 | N | N | N | N | Y |
| 543 | CLASSIFICATION (I.E. DME) | Y | N | N | 12 | N | N | Y | N | Y |
| 544 | BILL INSURANCE? | Y | N | Y | 1 | N | N | N | N | Y |
| 545 | TYPE OF SERVICE (I.E. DIAGNOSTIC, DME RENTAL, DME PURCHASE) | Y | N | N | 30 | N | Y | N | N | Y |
| 546 | (SE)RVICE ID QUAL (I.E. HCPC'S) | Y | N | N | 24 | N | Y | N | N | Y |
| 547 | (…)ABLE? (cut off; probably "TAXABLE?" (guess)) | Y | N | Y (guess) | 1 (guess) | … | | | | |

(Rows 547-573 are not captured in this batch.)

**ADD A NEW RENDERING PROVIDER: BILLING TAB** (screenshot 73)

| Row | Field | Man | Auto | SC | Chars | Mult | DD | Search | Cal | Can chg |
|---|---|---|---|---|---|---|---|---|---|---|
| 711 | RENDERING PROVIDER ID | Y | N | Y | 4 | N | N | Y | N | Y |
| 712 | (SHO)RT CODE (cut off) | Y | N | Y | 4 (guess) | N | N | Y (guess) | N | Y |

(Rows 713-773 are not captured.)

**ADD A NEW REFERRING PHYSICIAN** (screenshot 76)

| Row | Field | Man | Auto | SC | Chars | Mult | DD | Search | Cal | Can chg |
|---|---|---|---|---|---|---|---|---|---|---|
| 839 | ID: | Y | N | Y | 4 | N | N | N | N | Y |
| 840 | SHORT CODE | Y | N | Y | 4 | N | N | N | N | Y |
| 841 | NPI: | Y | N | N | 10 | N | N | N | N | Y |
| 842 | ORG/LAST NAME | Y | N | N | 50 | N | N | N | N | Y |
| 843 | FIRST NAME | Y | N | N | 50 | N | N | N | N | Y |
| 844 | MIDDLE INITIAL | Y | N | N | 2 | N | N | N | N | Y |
| 845 | TITLE | Y | N | N | 5 | N | N | N | N | Y |
| 846 | SPECIALTY | Y | N | N | 24 | N | Y | N | N | Y |
| 847 | SUBSPECIALTY | Y | N | N | 24 | N | Y | N | N | Y |
| 848 | CONTACT | Y | N | N | 80 | N | N | N | N | Y |
| 849 | ADDRESS 1 | Y | N | N | 80 | N | N | N | N | Y |
| 850 | ADDRESS 2 | Y | N | N | 80 | N | N | N | N | Y |
| 851 | (…)CODE (cut off; probably ZIP CODE (guess)) | Y | N | N | 10 (guess) | N | N | N | N | Y |

### (b) Old billing system screen contents (pasted screenshots)

**Data menu (left list):** Panel Menu · Procedure Menu · Product Inventory Menu · Rendering Provider Menu · Referring Person List · Referring Physician Menu · Rolodex Menu · Room Menu · Serialized Product Inventory Menu · Zip Code List

**Modifier List** (toolbar: Add, Modify, Delete, Filter, Print Preview, Print, Close; columns: Name, Class, Description; Total: 14). Standard modifier codes listed:
59 SEPARATE SERVICE · CG MEETS MEDICAL NECESSITY · GA WAIVER OF LIABILITY-ABN · GP PHYSICAL THERAPY CARE · GZ EXPECTED TO BE DENIED · KF FDA CLASS III DEVICE · KH PURCHASE OR FIRST MONTH · KR PARTIAL MONTH RENTAL · KX MEETS MED NECESSITY REQUI(REMENTS) · LT LEFT SIDE · NU PURCHASE ITEM · RR RENTAL ITEM · RT RIGHT SIDE · UE USED EQUIPMENT

**Add a New Note:** Ok · ? · Cancel; fields Notes Name (with lookup), Short Code; a large text area; footer "Entered [date] By [user initials]".

**Panel Menu:** Add a New Procedure Panel · Edit Procedure Panel · Delete Procedure Panel · List Procedure Panels · Rebuild panel Search

**Procedure Menu:** Add a New Procedure Code · Edit Procedure Code · Delete Procedure Code · List Procedure sort by Codes · List Procedure sort by Desc · Increase/Decrease All Procedure Prices · Rebuild Procedure Search · Build AMA file

**Add a New Procedure Code** has these tabs: Procedure Code | NDC Reporting | Order | Recall/Reminders. Toolbar: Ok · ? · Notes · Tax Notes · Alert Conditions · Print · Cancel.
- *NDC Reporting tab:* NDC Code, Drug Unit Price, Reimbursement Price, Composite Unit of Measure (dropdown), HCPCS Units (as shown in HCPCS book), NDC Units (as shown in FDA NDC code list). Help text explains that NDC QTY is calculated from the HCPCS quantity and units, and there is an "NDC Billing Document" button.
- *Order tab:* help text says an EMR order is associated with the procedure so that selecting it from the electronic superbill creates the order automatically. Fields: "Does this procedure correspond to an Order?", "Is this procedure performed outside of office?", Order Type, "Instructions for performing this order", and "Diagnosis corresponding to this order" (8 Diagnosis Code + Desc slots).

**Increase/Decrease All Procedure Prices:** "Percent of increase/decrease in CPT prices: (negative no to decrease)"; Cancel.

**Add a New Product** (toolbar: Ok, ?, Notes, Print, Cancel):
- Product Code, Short Code, Procedure (lookup), Description, Vendor Name (lookup), Phone, Contact Person, Classification (lookup)
- Wholesale Price, Retail Price, Purchased Price, Percentage Taxable, Percent Tax, Retail Price + Tax, Units
- Part No, Catalog Page No, Current Stock, Last Order Date, Scale, Min. Stock Level, Order Date, Received, Reorder QTY, Back-order Date
- "Frame Information": Category (dropdown), Color, Temple Length, Eye, DBL
- footer Entered [date] By [initials]

**Product Inventory List:** toolbar Add/Modify/Delete/Filter/Print Preview/Print/Close; "No Data".

**Rendering Provider Menu:** Add a New Rendering Provider · Edit/Display Rendering Provider · Delete Rendering Provider · Mailing Labels for Rendering Providers · List Rendering Providers

**Add a New Rendering Provider** has these tabs: Billing | EHR ICD9s | EHR Procedures | EHR Medications. Toolbar: Ok · ? · Notes · Print · Email · Add Electronic Signature to doctor record · Add Logo · Cancel.
- *EHR ICD9s tab:* "Select the most commonly used ICD9s to appear in EHR's 'Assessment' tab"; a checklist of generic ICD-9 codes and descriptions (a reference list, not tied to any patient).
- *EHR Procedures tab:* "Push 'Enter' or change doctor id to copy from another doctor"; Select/Cpt Code/Desc grid; Open Procedures / Close Procedures buttons; "No data to display".
- *EHR Medications tab:* Selected/Name/Description grid, empty.

**Referring List (web version)** (Referring Person List): + Add New, a search box, and a grid with columns Name, SC, Last Name, First Name, Class, Address, Addr2, City, … (empty).

**Referring Physician Menu:** Add a New Referring Physician · Edit/Display Referring Physician · Delete Referring Physician · Mailing Labels · List Referring Physicians · Rebuild Ref Doctor Search

**Mailing Labels dialog:** Print · Print Preview · Close; option "Include Phone Number"; Template dropdown with Avery/Dymo label templates (AVERY5160_ADDR&PHONE, AVERY5160_ADDR, AVERY5160_BLANK, AVERY5160_QUICK, AVERY5161_…, AVERY5162_…, AVERY5163_…, AVERY5167_ADDR, AVERY5197_…, DYMO, DYMOSINGLE); Customize Rows/Cols; selected/non-printable record counts.

**List Referring Physicians:** toolbar Delete/Print/Close; columns Ref Physician Name, ID, Addr, City, St, Zip, Phone, Fax, NPI, Specialty. The rows contain real physician names, addresses, phone numbers and NPIs: [REDACTED].

---

## REPORTS (gid=273177730), screenshots 79-83

### (a) Spec text written in the sheet
- Rows 1-9: pasted old-system Reports menu.
- 11: **REPORTS USED**
- 12: **ACCOUNTING REPORTS MENU**
- 13: **DAILY ACTIVITY REPORT**
- 14-15: "**EXAMPLE OF HOW REPORT POPULATES INCLUDED IN DOCUMENTS***"
- ~32: **COLLECTION REPORTS MENU**; **AGING REPORT (HOW OUTSTANDING AR IS RAN)**, with the same "EXAMPLE … INCLUDED IN DOCUMENTS" note (from OCR)
- 50: **PRODUCTION REPORTS**
- 63: **MONTHLY HISTORICAL RECEIVABLES**, with the same note (from OCR)
- 80: **EXCEL REPORT GENERATOR**
- 81: **REPORTS**
- 82-83: "**EXAMPLE OF HOW REPORT POPULATES INCLUDED IN DOCUMENTS***"

### (b) Old billing system screen contents

**Reports menu bar:** Reports · Letters · Word · Help. Items: Accounting Reports Menu ▸ · Collection Reports Menu ▸ · Production Reports Menu ▸ · Excel Report Generator · Information reporting for California ▸ · Document - Sample of Reports

**DAILY ACTIVITY REPORT parameter screen:**
- Buttons: Prepare Report · Print · Print Preview · Excel · Save Parameters · Report Documentation · Close
- Activity From / To (dates); Report Type: BAL FWRD/POST DATE; Calculate Previous Balances; Page Break Between Each Day
- Groupings: First / Second Group Criteria (DO NOT USE GROUPING); Show Pie Chart; Show Bar Chart
- Patient Options: Detailed (checked)
- Itemize Trans: ITEMIZE EVERY TRANSACTION; Sort by: TRANSACTION TYPE; Print On Report: USER ID
- "Which Transaction To Include on Report?": All · Charges · Claims · Payments (checked) · Writeoffs (checked) · Adjustments · Refunds · Statements
- Filters: Coverage Type, Primary Ins, Secondary Ins, Employer, Referred By, Attorney, Fee Schedule, User ID, Batch No, Patient Class, State, Superbill No, Provider Class, Billing Provider, Provider, Ref Doctor on Pat Reg, Facility, Asst Doctor, Claim (dropdown)

**AGING REPORT parameter screen** (from OCR, partial):
- Buttons: Print · Preview · Save Param(eters)
- "Include patients with Zero balances or Credit balances". Note: "Check the above box so the totals in this report match the (totals) in the other reports; this report takes more (time)"
- Aging Options: Aging Period Starts: 1; Aging Period Duration; Periods 1-5 (bucket values only partly legible)
- "Include patients that have balance in the Aging Periods: PERIODS 1 THRU 5"; Include Warning Remarks / latest Ledger Remark
- Filters: Coverage Type (example "MC"), Secondary Ins, Employer, Billing Provider, Rend Provider, Age Periods, Provider Class, Ref Doctor, Collector User, Batch No
- Patient Options: Detailed; First Patient / Last Patient ("Leave empty for All Patients")
- Group Criteria options: DO NOT USE GROUPING · PROVIDER · ASSISTING PROVIDER · FACILITY · PRIMARY INSURANCE · SECONDARY INSURANCE · REFERRING DOCTOR · REFERRING PARTY · EMPLOYER · ATTORNEY · PATIENT CLASSIFICATION · COVERAGE TYPE · COLLECTION AGENCY · PROVIDER SPECIALTY · STATE (example: First Group = PRIMARY INSURANCE)

**MONTHLY HISTORICAL RECEIVABLES REPORT** (from OCR):
- Buttons: Prepare Report · Print · Print Preview · Save Parameters · Close
- Activity From / To ("not to exceed one year"); Report Type: BAL FWRD/POST DATE; Groupings (same option list)
- Itemize every Day (Detailed Summary); Page break between First Group criteria; Show Bar Chart
- Filters: Coverage Type, Patient Class, Primary Ins, Billing Provider, Secondary Ins, Provider Class, Employer, Fee Schedule, Batch No, Provider, Facility, State

**EXCEL REPORT GENERATOR** (screenshot 83):
- Title text: "Excel Report Generator will create a CSV file under subfolder ExcelTempFiles and opens it with Excel"
- Buttons: Generate Excel file · Close
- "Please select a 'Query Type' from the list shown below." Query Types: Labels · Lists · Recalls · Reports
- "Now select a 'Query Name' and follow the instructions as displayed in the 'Instructions' box."
- Query Names visible for Reports: Revenue by Primary Diagnosis · Score Refund Test · Score Report · Service Line Items · Workers Comp Service Line Items
- Instructions example: "This report will generate Kinex Care Report. 1- Enter from date (Leave empty for all). 2- Enter to date."
- Inputs: From Date, To Date (date pickers), and a "Dct" lookup

---

---

## Appendix: Which screenshot shows what

### Batch 1 (screenshots 1-21)

Method note: the Drive OCR text (read_file_content) was messy and came back EMPTY for #12, #16, #18, #19, #20. For all 21 screenshots I also downloaded the original PNG and read it visually, so the content below is mostly from the images rather than OCR alone. The "OCR quality" column rates the Drive OCR text; image readability was good for all 21.

**Old system identified:** the pasted screens are from **"Practice Expert Version 2018"** by **Cal-Med / CalMed** (window title "Practice Expert Version 2018 - Built:..."; menus say "Import from HL7 to Calmed", "latest version of Practice Expert from Cal-med web site", "CalMed's Server"). Electronic claims go through **Office Ally** (tutorial menu items).

**Test patient:** almost every old-system screenshot uses a dummy account named "TEST, TEST". Its ID, DOB, phone, payer member ID and diagnosis codes are still shown as [REDACTED] below.

| # | file id | tab | rows/section shown | OCR quality |
|---|---|---|---|---|
| 1 | 1Vs9E9YwDu98UfP_MIWoPCIo6cy9XMYDr | PT ENTRY (gid 1848707432) | rows 52-81: "EXAMPLE:" old Register New Patient screen + subscriber auto-fill note | partial |
| 2 | 1TrIDKQMwemi2wi1XP-oEWzx-jqf35aiU | PT LEDGER (gid 148209206) | rows 11-42: claim submission line, FINANCIAL POSTINGS color rules, ledger screenshot, FUNCTIONS (Post Pay/Notes/Alerts) | partial |
| 3 | 1fQwAw-0J7IBjN2hQG5NSWTXgDFSWSyPO | PT LEDGER | rows 30-60: Functions, ALERT popup screenshot, PRINT | partial |
| 4 | 1vasvK2MRtFy-2cM_IwabGv5I-VYJA83r | PT LEDGER | rows 51-81: PRINT dialog, REMOVE/PAT/PRVW ELEC/SUMMARY, Financial Summary | partial |
| 5 | 1-zCQ5tdtL3D3OB1z4buHAqZXPY7yKztY | PT LEDGER | rows 66-96: REMOVE..SUMMARY, Financial Summary, SCAN/FIND/PEND CALLS/NEW CALLS | good |
| 6 | 1gL98EwUfJyfxWt4rhC1YAoCQEiTQddoE | CHARGE ENTRY (gid 469183278) | rows ~100-130: diagnosis-code note, FRONT SCREEN (Service Lines Posting), start of BACK SCREEN | partial |
| 7 | 1rQAWa1RZ8DW29HcdkQQHGseCJzKQf9rN | CHARGE ENTRY | rows 122-151: BACK SCREEN (Edit Claim Data), start of PRINTING CLAIM | partial |
| 8 | 10ejPFCeQqB_RWpzjm9oJP2behqg2Kj9U | CHARGE ENTRY | rows 146-175: PRINTING CLAIM (Summary tab), DETAIL | partial (little text) |
| 9 | 1ioZiFWJ73eBUNYDBAoQ8kjKuM5i1Mmuk | CHARGE ENTRY | rows 162-191: DETAIL, ERRORS | partial (little text) |
| 10 | 1-mBZvSDSC21MeCxLA-ivVgareaL0T7TJ | CHARGE ENTRY | rows 190-219: PARAMETERS (Claims Parameters tab) | partial |
| 11 | 1XfPxeWjXb-_K_G4j7Qu8XyPgQS-ruQqv | PAYMENT POSTING (gid 248895820) | rows 67-97: FRONT SCREEN (BULK POSTING) | partial |
| 12 | 1zoT3Eu-Kgpyzth-QK6xD0P_CVNe1lXXt | PAYMENT POSTING | rows 95-124: BACK SCREEN (LINE ITEM POSTING, ALLOWS 20 LINES), start of PAT SHARE DROP DOWN | empty (read from image) |
| 13 | 1ofN3KCBHgRlAjHmyai_kfMUmP2tg7LAt | PAYMENT POSTING | rows 107-136: PAT SHARE DROP DOWN, PRINT STATEMENT DROP DOWN | partial |
| 14 | 1JQYqtfeeXQmvp6nR8EVkjEh4FdDPn-p9 | PAYMENT POSTING | rows 122-151: PRINT STATEMENT DROP DOWN, WRITE OFF DROP DOWN | partial |
| 15 | 1cAvRopugDk0lRl-4Fu_FEd4xW0pB5pHY | PAYMENT POSTING | rows 139-168: full WRITE OFF dropdown list | good |
| 16 | 18ZfALx08_F6hUmQfWJluDCHhwRBc5j3J | FILE MENU (gid 1614108721) | rows 1-31: FILE menu list, EDIT COMPANY & OPTIONS | empty (read from image) |
| 17 | 1qmycPqWswQhMm7YsrRf4uooffHFa91bm | FILE MENU | rows 17-47: EDIT COMPANY & OPTIONS (Company/Provider/Misc tabs), PORTAL OPTIONS | partial |
| 18 | 1FEEoOh8W6XVda3GS1cIPQWTyUBT_g_gi | FILE MENU | rows 36-66: PORTAL OPTIONS, PORTAL DOCS, TUTORIAL MENUS | empty (read from image) |
| 19 | 1QGt-9rhGD9Q976ODa3ZHswfeF8S9HZrv | FILE MENU | rows 55-85: TUTORIAL MENUS, USERID/PASSWORD, Add New User screens | empty (read from image) |
| 20 | 1kWbp3Zq-xmJkAk4DIG2yplorLEVRqs_L | FILE MENU | rows 66-97: USERID/PASSWORD, EDIT USER, LIST USER/PASSWORDS | empty (read from image) |
| 21 | 18VNY9DE7P5o-18JJ8Xldo4EhRO2b2jJ6 | FILE MENU | rows 57-87, columns L-AC (scrolled right): tutorial sub-menus, Add New User tabs (Billing/Data/Scheduling) | partial |

---


### Batch 2 (screenshots 22-42)

Method note: Drive OCR (`read_file_content`) returned empty text for 8 of the 21 images (22, 30, 31, 33, 34, 35, 36, 42), even when retried. Every image in this batch was therefore also downloaded as the original PNG and read visually at full resolution, which confirmed and corrected the OCR. The "OCR quality" column shows the Drive OCR result. The content below comes from the visual read where that was clearer.

Tab gid map seen in this batch: FILE MENU = 1614108721, PAT MENU = 480229675, TRAN MENU = 2044798134, SCH MENU = 1745815901, EHR MENU = 374226548, BILLS MENU = 1782448926, STATEMENTS = 795670364.

**Old system name:** In the sheet's FILE MENU tab, the old system is called **"CalMed" / "Cal-Med"** (e.g. "IMPORT FROM HL7 TO CALMED", "IMPORT FROM TEXT TO CAL-MED MENU"). The old-system statement template list also includes "STATEMENT_CALMED2". A version banner on the old-system menus reads "...xpert Version 2018 - Built: 03/17/24" (the full product name is cut off; it may be "Cal-Med Expert" (guess)). The old system has a Windows-style top menu bar: Tran, Sch, EHR, Bills, Elec, Data, Calls, Imaging, Reports, Letters, Word.

| # | file id | tab | rows/section shown | OCR quality |
|---|---|---|---|---|
| 22 | 1d_wPXl_UAGXmPmsnWocJRttT92NGKILN | FILE MENU | Cols T-AJ, rows 58-88: Office Ally / CMS-1500 / UB-04 / Data help sub-menus; "CAPTIATION DOCUMENT: PDF"; two "Add New User" dialogs (Data tab, Scheduling tab) | empty |
| 23 | 1WSTScf9Xt-Ssuh-B1ORs949Hs4ZtPI3N | FILE MENU | Rows 85-115: EDIT USER, LIST USER/PASSWORDS, ADMIN SETTINGS, start of **UNUSED FEATURES list | good |
| 24 | 1Ips5psc32Be4Aemm3wtUt8oskrpnScXt | FILE MENU | Rows 106-136: UNUSED FEATURES list, EXIT | good |
| 25 | 1aoc2Dm5dP2Yt4xAsddy-jVAE2OG5sITB | PAT MENU | Rows 1-31 col A (patient menu items + PATIENT LIST QUERY SPECS); old "Query Patients" dialog (3 tabs) | partial |
| 26 | 1hQ2ZMY1cc84HQaI9N14DfHNJOYAO_ReA | TRAN MENU | Rows 1-31: PATIENT LEDGERS MENU, DAILY ACTIVITY MENU, EMPLOYEE DAILY PRODUCTIVITY REPORT | good |
| 27 | 1WuONOfYHYlwvcTrBRnjxBZeXibRZsAfD | TRAN MENU | Rows 31-62: rest of Daily Activity menu, sample productivity report, SERVICE LINES POSTING MENU | good |
| 28 | 1aNLJPfIR8dejzDXELK2Qt9o1C_Xd7zFa | TRAN MENU | Rows 64-94: PAYMENTS & WRITE OFF MENU, ADJUSTMENTS/REFUNDS MENU, TAR MENU | good |
| 29 | 15vD3iRTAh5SJmTzIKbh4S-1bYQ8RFR7Z | TRAN MENU | Rows 89-119: TAR MENU, QUOTE MENU, COPY BILLING PROVIDERS... | good |
| 30 | 11GEDlBB2JA1WwNA1XLrG0Es9RpywfFTB | TRAN MENU | Rows 110-140: COPY BILLING PROVIDERS x2, SQL2008/SQL2012 INTEGRITY TEST (end of tab) | empty |
| 31 | 1q5_rWE8Z0T92jyKMNwdh65FwGQqe9Xot | SCH MENU | Rows 1-31: SCHEDULING MENU, SUPERBILLS/PR2S/REGISTRATIONS MENU, RECALL MENU | empty |
| 32 | 1Dyzjtt4I5XBJ1GGT-OEjXLiHVr-RQnHI | SCH MENU | Rows 23-54: RECALL, DELIVERY, TEMPLATE SETUP, SCHEDULING DOCUMENTS | good |
| 33 | 1WnD2rFOsgPX1RG_W2RrJkdO1j0FmrqHb | EHR MENU | Rows 1-31: "ALL UNUSED FEATURES:" plus the old EHR menu | empty |
| 34 | 1ptGIy7pHkdz5IMsCpaoSHO9uT9apqEMe | BILLS MENU | Rows 1-31: 1500 HEALTH CLAIM FORMS MENU, UB-04 PAPER CLAIM FORMS MENU | empty |
| 35 | 17Ad4wFYfJsS1VmqLqPkrGbGlmO638Rds | BILLS MENU | Rows 20-50: UB-04, CHDP PAPER CLAIM FORMS MENU, start of STATEMENTS & RECEIPTS | empty |
| 36 | 15kxDufshFcfN8QRiczuFtYlFjNhhfLxo | BILLS MENU | Rows 49-79: STATEMENTS & RECEIPTS MENU, INDUSTRIAL BILLING MENU, WORKER COMP/PI BILLING MENU | empty |
| 37 | 1DQQ5u1S8mvBuyIolXw0tJI1PJ-c9xOzk | BILLS MENU | Rows 74-104: WORKER COMP/PI BILLING MENU, CLAIMS APPEAL MENU | good |
| 38 | 1Jb_SpXCi8SkWD6kitKqtUQ7QlxfLhzt8 | BILLS MENU | Rows 94-124: CLAIMS APPEAL, TRACER MENU, start of MEDI-CAL CLAIMS INQUIRY | good |
| 39 | 1FK4xkL9LL-hdYiMoJIHHcmAscaaysRn9 | BILLS MENU | Rows 122-151: MEDI-CAL CLAIMS INQUIRY MENU, CMN MENU (end of tab) | good |
| 40 | 1-zemBQoBhkWlmvuLIT4OVTNwLRPKpOU0 | STATEMENTS | Header rows 1-2, rows 16-43: statement options + filter spec rows with Y/N values; Address/Messages tab | partial |
| 41 | 1p07Qtz7x2B3EOADokwpFSlwCIJhXKQ-7 | STATEMENTS | Rows 52-80: Announcements box, Customized Messages box | partial |
| 42 | 1YZwtGmx7JiXUADgBMC4_opNkqnX4CUJE | STATEMENTS | Rows 66-95: Customized Messages, 30+ DAY DUNNING MSG | empty |

---


### Batch 3 (screenshots 43-63)

Method note: Drive OCR was partial for most images and empty for 50, 56, 57, 59, 60 and 63. I downloaded every image and read it visually, so the content below comes from the actual screenshots, not just OCR. The active tab was confirmed each time from the highlighted (blue) tab in the bottom tab bar.

Column key for the spec tables: B = MANUAL ENTRY?, C = AUTO POPULATES (FROM PT SET UP?), D = SHORT CODE?, E = NUMBER OF CHARACTERS, F = MULTIPLE FIELDS?, G = DROP DOWN?, H = SEARCH OPTION?, I = CALENDAR OPTION?, J = CAN MANUALLY CHANGE?

| # | file id | tab | rows/section shown | OCR quality |
|---|---------|-----|--------------------|-------------|
| 43 | 1CHHpWEmVql4OZAanhkniSIqwLdGAtI9O | STATEMENTS (gid 795670364) | rows 99-126: 60+ and 90+ day dunning messages | partial |
| 44 | 1YHh9ubRtW_XkW9DdJkw2XgESJ4RqKkwu | STATEMENTS | rows 136-164: 120+ day dunning msg, FULL STATEMENT WINDOW | partial |
| 45 | 1_h63R2vTDXp4t8JbL31DiRWpFaytGjq1 | STATEMENTS | rows 152-180: full statement window, STATEMENT FOR ALL PATIENTS, RECEIPT FOR ONE PATIENT | partial |
| 46 | 1T3uDejQUa9l6BpwkPwy1HMax8FsCpaRD | STATEMENTS | rows 168-197: receipt screen, ITEMIZED STATEMENT, POST FINANCE/LATE FEE CHARGES header and first fields | partial |
| 47 | 1PFUxOgEb7bKbX9diSfz9sqM4aec-qImn | STATEMENTS | rows 193-221: finance/late fee fields, PREPRINTED STATEMENT FORM ORDERING INFO | partial |
| 48 | 1nm1bxviEbzfrNkOang0DbGnHe-_vKsGv | WORKCOMP (gid 1692209104) | rows 1-31: RFA screen, old Worker Comp/PI Billing menu, unused features | partial |
| 49 | 1UVXJbcQ9Ji3mDS1qVEgQDmVB8eU3H05b | WORKCOMP | rows 40-71: Document Cover/Separator Sheet, Provider's Request for Second Bill Review | partial |
| 50 | 1LCyKitIxr8lGKFMZyHKL_q5pvF-EprXR | ELEC MENU | rows 1-31: old Elec menu, electronic claims rows 18-27 | empty (read from image) |
| 51 | 19GEKRDuPkX1F6tTHX4phWMPqJEcvzCiL | ELEC MENU (gid 1435463382) | rows 24-55: ERA835, Medicare Remit Easy Print, Medi-Cal/Health Net CHDP, 277/999/5010 | partial |
| 52 | 1pMrt3qlgNaN-CbnzFmqJ3q1HFHSADs5W | DATA MENU (gid 1691826382) | rows 1-31: old Data menu list, APPOINTMENT TYPES MENU | partial |
| 53 | 1gx42j0x8ZXuUYx6eh_33vzZ5yW76YsaT | DATA MENU | rows 28-57: Appointment Types, Assisting Doctor, Attorney, BILLING PROVIDER MENU (2010AA tab) | partial |
| 54 | 17RZIMJ1j27ii871NHrFww3bENmVFUdG6 | DATA MENU | rows 103-132: Billing Provider fields (contact, IDs) | partial |
| 55 | 1QUNsFHVcyIk0dii4KgSEfi7eeCpZUuKt | DATA MENU | rows 146-173: COVERAGE MENU, ADD A NEW COVERAGE | partial |
| 56 | 1oZhlQ0OMoEPJ01tl7g1Hu4h4Ng3ccHS_ | DATA MENU | rows 167-195: end of Add Coverage, old Add Coverage screen, EDIT/DISPLAY & DELETE COVERAGE | empty (read from image) |
| 57 | 1zmi9vvM7dK45D42iHSnfwOlchVraYNnN | DATA MENU | rows 195-223: LIST COVERAGE, EMPLOYER MENU | empty (read from image) |
| 58 | 1ittSJgRpEGFr4KTeAs7eMZdh6UPSWVxf | DATA MENU | rows 213-242: EMPLOYER MENU, FACILITY MENU, ADD A NEW FACILITY (billing tab start) | partial |
| 59 | 12bxliVsTW8iK2xIS2wNcGak-Hcx-wgkU | DATA MENU | rows 289-317: facility legacy IDs, QUEST LAB TAB, LAB CORP TAB, EDIT/DELETE FACILITY, MAILING LABELS | empty (read from image) |
| 60 | 1s3wE50LwSjehuxhRADWHHcYcOmH2kPMU | DATA MENU | rows 314-342: MAILING LABELS FOR FACILITIES, LIST FACILITIES, INSURANCE MENU start | empty (read from image) |
| 61 | 1UrtLxGj6GFhtvPvY038yh7ildFd8tw8E | DATA MENU | rows 337-365: INSURANCE MENU, ADD A NEW INSURANCE COMPANY (carrier info tab) | partial |
| 62 | 1YQrY90RA7sGno7n6zVgb3Em7kcxe4UWq | DATA MENU | rows 414-443: MANAGED CARE TAB, LAW FIRM LIST, MODIFIER MENU | partial |
| 63 | 1FTOqRU0UvJFJlaGPHSm9Y511YtOMpX1j | DATA MENU | rows 436-464: MODIFIER MENU, ADD/EDIT/DELETE/LIST MODIFIERS | empty (read from image) |

Gaps in this batch, meaning rows that were scrolled past and never captured: STATEMENTS rows 127-135 and 181-187; WORKCOMP rows 32-39; DATA MENU rows 58-102, 133-145, 243-288, 366-413 and 465+.

---


### Batch 4 (screenshots 64-83)

**Revision 2:** I re-read the screenshots as images (downloaded PNGs) to fill gaps the OCR left. These were viewed visually: 64, 65, 67, 68, 72, 73, 74, 75, 76, 77, 78, 79, 83. The others (66, 69, 70, 71, 80, 81, 82) are still based on OCR text only.

**Tab identification (confirmed by image):** in the bottom tab bar, the active (highlighted) tab is **DATA MENU** for screenshots 64-78 (`gid=1691826382`) and **REPORTS** for 79-83 (`gid=273177730`). The old billing system's product name does not appear in any screenshot in this batch.

Column headers on the DATA MENU tab (columns B-J): MANUAL ENTRY? | AUTO POPULATES FROM PT SET UP? | SHORT CODE? | NUMBER OF CHARACTERS | MULTIPLE FIELDS? | DROP DOWN? | SEARCH OPTION? | CALENDAR OPTION? | CAN (MANUALLY CHANGE?; the header is cut off at the right edge, and so are its values, which read "Y").

| # | file id | tab | rows/section shown | OCR quality |
|---|---|---|---|---|
| 64 | 121s6MAfH09jXbzbhR_Gsko1-Irl_0dzA | DATA MENU | rows 455-484: LIST MODIFIERS, NOTES MENU, ADD A NEW NOTE, PANEL MENU | OCR empty; read from image |
| 65 | 1C8-qCFCn0p9RvZPG64jT3darGzstAIoa | DATA MENU | rows 467-495: NOTES MENU, PANEL MENU, ADD A NEW PROCEDURE PANEL (2 field rows) | read from image (good) |
| 66 | 1B-FM4aMXa-6943LslqxxfpPnxwukfzXW | DATA MENU | rows 505-532: LIST PROCEDURE PANELS, REBUILD PANEL SEARCH, PROCEDURE MENU | partial (OCR) |
| 67 | 1K9KGXrZpYRPj2xs1aM6YOCm0NorbtDe6 | DATA MENU | rows 518-546: REBUILD PANEL SEARCH, PROCEDURE MENU, ADD A NEW PROCEDURE CODE (Procedure Code tab fields) | OCR empty; read from image (good) |
| 68 | 1dI-3VZSQjKaN2kT31hKlij74zEuTgpAa | DATA MENU | rows 574-602: NDC REPORTING TAB, ORDER TAB, RECALL/REMINDERS | read from image (good) |
| 69 | 18-sqDYFoy68Dcky4HRDuS2T3NJ9Du4uK | DATA MENU | rows 602-630: RECALL/REMINDERS, EDIT/DELETE A PROCEDURE CODE, LIST PROCEDURE SORT BY CODES | partial (OCR) |
| 70 | 1KQkcdzB2pOzq96TECBjnXpIk7UO00pvz | DATA MENU | rows 622-649: LIST PROCEDURE SORT BY CODES / BY DESC, INCREASE/DECREASE ALL PROCEDURE PRICES | partial (OCR) |
| 71 | 1jn47dehxGrtKB0br6MK0WzoxwYBW3yJz | DATA MENU | rows 646-673: INCREASE/DECREASE PRICES, REBUILD PROCEDURE SEARCH, BUILD AMA FILE, PRODUCT INVENTORY MENU | partial (OCR) |
| 72 | 1FM8kNJ1gKag3aWbbVMObxLQW9ZUORFZl | DATA MENU | rows 660-688: PRODUCT INVENTORY MENU, ADD/EDIT/DELETE PRODUCT, LIST PRODUCTS BY DESCRIPTION | read from image (good) |
| 73 | 1vwEgW_PMLlosi1371UsmXYJb6LQpvHk9 | DATA MENU | rows 683-711: product lists, RENDERING PROVIDER MENU, ADD A NEW RENDERING PROVIDER (BILLING TAB, first field) | read from image (good) |
| 74 | 1U38ykiAmlIueSQGEuHZUiCfXB1fIdErk | DATA MENU | rows 774-802: EHR ICD9S TAB, EHR PROCEDURES TAB, EHR MEDICATIONS TAB | OCR empty; read from image (good) |
| 75 | 11V_Yf_IL3cT89i-xHIcAPO3WGoIwSyUn | DATA MENU | rows 800-828: EHR MEDICATIONS TAB, REFERRING PERSON LIST, REFERRING PHYSICIAN MENU | read from image (good) |
| 76 | 1C-yoThNyyu8WjL1qRUwpP4XEMMLNE-7N | DATA MENU | rows 822-850: REFERRING PHYSICIAN MENU, ADD A NEW REFERRING PHYSICIAN (12 field rows) | read from image (good) |
| 77 | 1m14aRTKrdJKohV002ok2CazqTQjLxeFG | DATA MENU | rows 887-915: DELETE REFERRING PHYSICIAN, MAILING LABELS, LIST REFERRING PHYSICIANS | read from image (good) |
| 78 | 1hhZUgPtXXTiNHdEVi5GKm3asTSMtizha | DATA MENU | rows 889-917: MAILING LABELS, LIST REFERRING PHYSICIANS, REBUILD REF DOCTOR SEARCH | read from image (bottom row hidden by an overlay) |
| 79 | 1nrV3LwIQ4oR2tIpubAQr456FWQhkLBAy | REPORTS | rows 1-31: Reports menu, REPORTS USED, DAILY ACTIVITY REPORT | read from image (good) |
| 80 | 1f3lJcSf4Bme5NjA0hknemJzgC0xf1esc | REPORTS | rows 28-58: COLLECTION REPORTS MENU, AGING REPORT, PRODUCTION REPORTS | partial (OCR) |
| 81 | 1xsYqf_opJ5e7J03HEhMuUOhzXSc7FIjX | REPORTS | rows 30-58: Aging report option screens (right-hand columns N-W) | partial (OCR) |
| 82 | 16iS1rVAaCoUZpkCkaveojwLQ0Fnkpa7W | REPORTS | rows 48-78: PRODUCTION REPORTS, MONTHLY HISTORICAL RECEIVABLES | partial (OCR) |
| 83 | 1Rosi94l41YTJevyw0mnVN6ton5KTxri7 | REPORTS | rows 77-106: EXCEL REPORT GENERATOR | OCR empty; read from image (good) |

Rows that fall in gaps between screenshots and appear in none of them: DATA MENU 496-504, 547-573 (the rest of the Procedure Code tab fields), 712-773 (the rest of the Add Rendering Provider fields), 851-886 (the rest of the Add Referring Physician fields, plus Edit/Display).

---

