// CONTROL DATABASE: shared by all clients. Holds NO patient data (PHI).
// Clients, users, permissions, payer directory and code sets only.
import { pgTable, serial, text, integer, boolean, timestamp, date, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // used for the client's own database name / folder
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  // "staff" = Caliber team. "client_portal" = a client's own staff (Phase 4).
  userType: text("user_type").notNull().default("staff"),
  role: text("role").notNull(),
  // Portal users belong to exactly one client. Staff use user_client_assignments.
  portalClientId: integer("portal_client_id").references(() => clients.id),
  // Patient portal users are linked to exactly one patient (an ID inside their client's own database).
  portalPatientId: integer("portal_patient_id"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  inactivityTimeoutMinutes: integer("inactivity_timeout_minutes").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
});

export const userClientAssignments = pgTable(
  "user_client_assignments",
  {
    userId: integer("user_id").notNull().references(() => users.id),
    clientId: integer("client_id").notNull().references(() => clients.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId] })],
);

// Login events only (no PHI). Patient-data events go to each client's own audit log.
export const loginAudit = pgTable("login_audit", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  email: text("email").notNull(),
  userId: integer("user_id"),
  event: text("event").notNull(), // login_ok, login_failed, logout, client_switch
  clientId: integer("client_id"),
  ip: text("ip"),
});

export const payers = pgTable("payers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  payerType: text("payer_type").notNull(), // see shared/picklists PAYER_TYPES
  state: text("state"),
  address1: text("address1"),
  city: text("city"),
  zip: text("zip"),
  phone: text("phone"),
  electronicPayerId: text("electronic_payer_id"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

// Code sets are versioned by date. Old codes are never deleted.
export const hcpcsCodes = pgTable(
  "hcpcs_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    source: text("source").notNull(), // e.g. "CMS HCPCS 2026 Q4 file" or "STARTER (unverified)"
    loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("hcpcs_code_from_idx").on(t.code, t.effectiveFrom)],
);

export const icd10Codes = pgTable(
  "icd10_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    // false for category "headers" (e.g. S83.5): not valid on a claim, a more specific code is required.
    billable: boolean("billable").notNull().default(true),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    source: text("source").notNull(),
    loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("icd10_code_from_idx").on(t.code, t.effectiveFrom)],
);

export const modifiers = pgTable("modifiers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  source: text("source").notNull(),
});

// Every load of an official code-set file: what, from where, which exact file, when, and what changed.
export const codeSetLoads = pgTable("code_set_loads", {
  id: serial("id").primaryKey(),
  codeSet: text("code_set").notNull(), // hcpcs | icd10cm
  version: text("version").notNull(), // e.g. "2026-10" (HCPCS quarter) or "FY2027"
  effectiveFrom: date("effective_from").notNull(),
  sourceUrl: text("source_url").notNull(),
  fileName: text("file_name").notNull(),
  sha256: text("sha256").notNull(),
  added: integer("added").notNull(),
  changed: integer("changed").notNull(),
  retired: integer("retired").notNull(),
  loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
  loadedBy: text("loaded_by").notNull(),
});

// Which documents each payer type needs before an order is "ready to bill".
// ASSUMPTION Q-017: starting list; Caliber to confirm.
export const documentRequirements = pgTable(
  "document_requirements",
  {
    id: serial("id").primaryKey(),
    payerType: text("payer_type").notNull(),
    docType: text("doc_type").notNull(),
    required: boolean("required").notNull().default(true),
    note: text("note"),
    source: text("source").notNull(),
  },
  (t) => [uniqueIndex("doc_req_idx").on(t.payerType, t.docType)],
);

// API keys for client systems (CENCOM, fax/email gateways). The key decides the client. Stored hashed.
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// Note templates Caliber can edit in Settings. Placeholders like {{patient}} fill in automatically.
export const noteTemplates = pgTable("note_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  body: text("body").notNull(),
  followUpDays: integer("follow_up_days"), // optional: create a follow-up this many days out
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

// Editable drop-down lists (write-off reasons, patient share reasons, note categories, payment types).
export const picklistItems = pgTable(
  "picklist_items",
  {
    id: serial("id").primaryKey(),
    list: text("list").notNull(), // writeoff, pat_share, note_category, payment_type
    code: text("code").notNull(),
    label: text("label").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("picklist_idx").on(t.list, t.code)],
);
