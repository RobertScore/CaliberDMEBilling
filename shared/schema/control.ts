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
  source: text("source").notNull(),
});
