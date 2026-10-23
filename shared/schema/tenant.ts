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
  allowedCents: integer("allowed_cents"), // line item posting: what the payer approved for this line
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
});

// Claim submissions and status changes (spec PT LEDGER: "CLAIM SUBMISSION (WHEN CLAIM PRINTED, TYPE, TO WHOM)").
// Append-only, like the ledger. encounters.claim_status holds the latest status for quick lookups.
export const claimEvents = pgTable("claim_events", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  encounterId: integer("encounter_id").notNull().references(() => encounters.id),
  status: text("status").notNull(),
  previousStatus: text("previous_status"),
  method: text("method"), // electronic, paper, fax, portal, mail (only when billed)
  sentTo: text("sent_to"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
});

// Account notes: can never be edited or removed (spec, PT LEDGER tab). Trigger-enforced.
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  body: text("body").notNull(),
  category: text("category").notNull().default("general"),
  followUpDate: date("follow_up_date"),
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

// Paperwork that arrived (fax, email, upload, portals, API) and is waiting to be read, matched and filed.
export const intakeItems = pgTable("intake_items", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sender: text("sender"),
  subject: text("subject"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("new"), // new, review, done, rejected
  reader: text("reader"), // claude, demo, manual
  extraction: jsonb("extraction"),
  readerError: text("reader_error"),
  suggestedPatientId: integer("suggested_patient_id"), // e.g. uploaded through that patient's own portal
  decision: text("decision"), // new | existing
  patientId: integer("patient_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  // Field by field: what the AI read, what was filed, and whether a person checked it (to measure AI accuracy).
  fieldReview: jsonb("field_review"),
  createdBy: text("created_by").notNull(),
});

// Every stored file. The bytes are encrypted with this client's key and kept in this client's own storage.
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  intakeId: integer("intake_id").references(() => intakeItems.id),
  docType: text("doc_type").notNull().default("other"),
  title: text("title"),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  source: text("source").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: text("uploaded_by").notNull(),
  // A person confirmed the type is right and the document is complete and readable.
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: text("verified_by"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by"),
  // Packets: how many pages a PDF has, and for a part split out of a packet, which file and pages it came from.
  pageCount: integer("page_count"),
  parentDocumentId: integer("parent_document_id"),
  pageFrom: integer("page_from"),
  pageTo: integer("page_to"),
});

// Follow-ups and the Call List. Created from notes with a follow-up date, or directly.
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  noteId: integer("note_id"),
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  assignedUserId: integer("assigned_user_id"),
  assignedInitials: text("assigned_initials"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  doneBy: text("done_by"),
});

// Data menu: providers and facilities for this client.
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // rendering, billing, ordering, referring
  name: text("name").notNull(),
  npi: text("npi"),
  taxonomy: text("taxonomy"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
});

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address1: text("address1"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  npi: text("npi"),
  active: boolean("active").notNull().default(true),
});

// Client-level settings (company info, ledger colors). Key/value.
export const clientSettings = pgTable("client_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
