// CLIENT DATABASE: one separate copy of this schema per DME client.
// Everything here may contain patient data (PHI). It must never be mixed across clients.
import { pgTable, serial, text, integer, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  accountNumber: text("account_number").notNull().unique(), // system assigned (Q-043)
  legacyId: text("legacy_id"), // ID from the old system, if any
  repInitials: text("rep_initials"),
  ssnEncrypted: text("ssn_encrypted"),
  ssnLast4: text("ssn_last4"),
  alias: text("alias"),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  middleInitial: text("middle_initial"),
  title: text("title"),
  dob: date("dob").notNull(),
  sex: text("sex").notNull(),
  maritalStatus: text("marital_status"),
  address1: text("address1"),
  address2: text("address2"),
  zip: text("zip"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("USA"),
  phone: text("phone"),
  cellPhone: text("cell_phone"),
  email: text("email"),
  employer: text("employer"),
  occupation: text("occupation"),
  language: text("language"),
  deceased: boolean("deceased").notNull().default(false),
  // Responsible party
  respRelationship: text("resp_relationship"),
  respLastName: text("resp_last_name"),
  respFirstName: text("resp_first_name"),
  respPhone: text("resp_phone"),
  // Nearest relative
  relativeName: text("relative_name"),
  relativeRelationship: text("relative_relationship"),
  relativePhone: text("relative_phone"),
  referringPhysician: text("referring_physician"),
  coverageType: text("coverage_type").notNull(), // WC, VA_DIRECT, VA_CCN, ...
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by"),
});

export const patientInsurances = pgTable("patient_insurances", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  rank: integer("rank").notNull(), // 1 primary, 2 secondary, 3 tertiary
  payerId: integer("payer_id").notNull(), // control database payer directory id
  payerName: text("payer_name").notNull(), // copied for display
  payerType: text("payer_type").notNull(),
  claimNumber: text("claim_number"), // Work Comp claim number
  copayCents: integer("copay_cents"),
  deductibleCents: integer("deductible_cents"),
  eligibleFrom: date("eligible_from"),
  eligibleTo: date("eligible_to"),
  relationshipToInsured: text("relationship_to_insured").notNull(),
  subscriberLastName: text("subscriber_last_name"),
  subscriberFirstName: text("subscriber_first_name"),
  subscriberDob: date("subscriber_dob"),
  subscriberSex: text("subscriber_sex"),
  memberIdEncrypted: text("member_id_encrypted"),
  memberIdLast4: text("member_id_last4"),
  groupNumber: text("group_number"),
  groupName: text("group_name"),
  // Work Comp
  dateOfInjury: date("date_of_injury"),
  employerName: text("employer_name"),
  adjusterName: text("adjuster_name"),
  adjusterPhone: text("adjuster_phone"),
  // VA / CCN
  referralNumber: text("referral_number"),
  authorizationNumber: text("authorization_number"),
});

// A "claim data" group: one set of service lines posted together (old system "Service Lines Posting").
export const encounters = pgTable("encounters", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  serviceDateFrom: date("service_date_from").notNull(),
  serviceDateTo: date("service_date_to").notNull(),
  renderingProvider: text("rendering_provider"),
  billingProvider: text("billing_provider"),
  facility: text("facility"),
  orderingDoctor: text("ordering_doctor"),
  priorAuthNumber: text("prior_auth_number"),
  priorAuthExpires: date("prior_auth_expires"),
  diagnosisCodes: jsonb("diagnosis_codes").$type<string[]>().notNull(), // A-L, up to 12
  insuranceRank: integer("insurance_rank").notNull().default(1),
  claimStatus: text("claim_status").notNull().default("not_billed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
});

export const serviceLines = pgTable("service_lines", {
  id: serial("id").primaryKey(),
  encounterId: integer("encounter_id").notNull().references(() => encounters.id),
  lineNumber: integer("line_number").notNull(),
  hcpcsCode: text("hcpcs_code").notNull(),
  modifiers: jsonb("modifiers").$type<string[]>().notNull(),
  description: text("description").notNull(),
  diagnosisPointers: text("diagnosis_pointers").notNull(), // e.g. "AB"
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  chargeCents: integer("charge_cents").notNull(),
});

// THE LEDGER. Append-only: rows can never be updated or deleted (enforced by a database trigger).
// Mistakes are fixed with a reversing entry that points to the original.
// Balances are always computed by adding up these rows.
export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  kind: text("kind").notNull(), // charge, payment, writeoff, pat_share, refund, adjustment
  postDate: date("post_date").notNull(),
  serviceDateFrom: date("service_date_from"),
  serviceDateTo: date("service_date_to"),
  depositDate: date("deposit_date"),
  serviceLineId: integer("service_line_id").references(() => serviceLines.id),
  encounterId: integer("encounter_id").references(() => encounters.id),
  code: text("code"), // HCPCS code for charges
  description: text("description").notNull(),
  quantity: integer("quantity"),
  // How this entry changes what insurance owes and what the patient owes (cents, signed).
  insuranceDeltaCents: integer("insurance_delta_cents").notNull(),
  patientDeltaCents: integer("patient_delta_cents").notNull(),
  payerName: text("payer_name"),
  paymentType: text("payment_type"),
  checkNumber: text("check_number"),
  claimControlNumber: text("claim_control_number"),
  reasonCode: text("reason_code"), // write-off type or patient-share type
  batchNumber: text("batch_number"),
  reversesEntryId: integer("reverses_entry_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
});

// Account notes: can never be edited or removed (spec, PT LEDGER tab). Trigger-enforced.
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
});

// Alerts: shown when the account opens. Entered by hand and can be removed (kept for history).
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by"),
});

// Closed accounting periods. Nothing dated on or before closedThrough can be posted.
export const periodCloses = pgTable("period_closes", {
  id: serial("id").primaryKey(),
  closedThrough: date("closed_through").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  closedBy: text("closed_by").notNull(),
});

// Audit log: every view, create, change, remove, export and print of patient data.
// Append-only (trigger-enforced).
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id").notNull(),
  userInitials: text("user_initials").notNull(),
  action: text("action").notNull(), // view, create, update, remove, reveal, post, reverse, close
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  patientId: integer("patient_id"),
  details: text("details"), // never PHI values, only field names / counts
});
