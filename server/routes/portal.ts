// Client portal (a DME client's own staff) and patient portal (a patient's own account).
// "Minimum necessary": each returns only what that kind of user needs. No SSNs, no internal notes.
import { Router, type Request } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { encounters, intakeItems, ledgerEntries, notes, patientInsurances, patients, tasks, documents } from "@shared/schema/tenant";
import { apiKeys, clients, loginAudit, users } from "@shared/schema/control";
import { CLIENT_PORTAL_ROLES, ROLE_LABELS, type Role } from "@shared/permissions";
import { docTypeLabel } from "@shared/documents";
import { sumCents } from "@shared/money";
import { todayIso } from "@shared/dates";
import { getControlDb } from "../db/control";
import { getTenant } from "../db/tenantDb";
import { publish } from "../lib/events";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { documentChecklist, upload } from "./documents";
import { createIntake } from "./intake";
import { tempPassword } from "./admin";

export const portalRouter = Router();
const clientPortal = Router();
clientPortal.use(requireAuth, requireClient, requirePermission("portal.client.view"));
portalRouter.use("/api/portal/client", clientPortal);
const patientPortal = Router();
patientPortal.use(requireAuth, requireClient, requirePermission("portal.patient.self"));
portalRouter.use("/api/portal/me", patientPortal);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

const STATUS_WORDS: Record<string, string> = { not_billed: "Being prepared for billing", billed: "Sent to the payer", paid: "Paid", denied: "Denied: we're working on it" };

async function claimSummaries(req: Request, patientId: number) {
  const db = req.tenant!.db;
  const encs = await db.select().from(encounters).where(eq(encounters.patientId, patientId)).orderBy(desc(encounters.serviceDateFrom));
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.patientId, patientId));
  return encs.map((e) => {
    const es = entries.filter((x) => x.encounterId === e.id);
    return {
      id: e.id,
      serviceDateFrom: e.serviceDateFrom,
      serviceDateTo: e.serviceDateTo,
      status: e.claimStatus,
      statusText: STATUS_WORDS[e.claimStatus] ?? e.claimStatus,
      billedCents: sumCents(es.filter((x) => x.kind === "charge").map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
      paidCents: -sumCents(es.filter((x) => x.kind === "payment").map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
      balanceCents: sumCents(es.map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
    };
  });
}

// ---- Client portal ----------------------------------------------------------------------

clientPortal.get("/dashboard", async (req, res) => {
  const db = req.tenant!.db;
  const [c] = await getControlDb().select().from(clients).where(eq(clients.id, req.tenant!.clientId));
  const pts = await db.select({ id: patients.id }).from(patients).where(isNull(patients.removedAt));
  const [tot] = await db.select({ ins: sql<number>`coalesce(sum(insurance_delta_cents),0)::int`, pat: sql<number>`coalesce(sum(patient_delta_cents),0)::int` }).from(ledgerEntries);
  const [{ notBilled }] = await db.select({ notBilled: sql<number>`count(*)::int` }).from(encounters).where(eq(encounters.claimStatus, "not_billed"));
  const monthStart = todayIso().slice(0, 8) + "01";
  const [{ collected }] = await db.select({ collected: sql<number>`coalesce(-sum(insurance_delta_cents + patient_delta_cents),0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.kind, "payment"), sql`${ledgerEntries.postDate} >= ${monthStart}`));
  let missingDocs = 0;
  for (const p of pts) missingDocs += (await documentChecklist(req.tenant!, p.id)).missingCount;
  const [{ inReview }] = await db.select({ inReview: sql<number>`count(*)::int` }).from(intakeItems).where(inArray(intakeItems.status, ["reading", "review"]));
  await audit(req, { action: "view", entityType: "portal.dashboard" });
  res.json({ clientName: c?.name, patients: pts.length, insuranceOwedCents: tot.ins, patientOwedCents: tot.pat, claimsBeingPrepared: notBilled, collectedThisMonthCents: collected, missingDocuments: missingDocs, paperworkInReview: inReview });
});

clientPortal.get("/patients", async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50).replace(/[%_]/g, "") : "";
  const rows = await req.tenant!.db
    .select({
      id: patients.id, accountNumber: patients.accountNumber, lastName: patients.lastName, firstName: patients.firstName, dob: patients.dob, coverageType: patients.coverageType,
      balanceCents: sql<number>`coalesce((select sum(insurance_delta_cents + patient_delta_cents) from ledger_entries le where le.patient_id = "patients"."id"), 0)::int`,
      claims: sql<number>`(select count(*)::int from encounters e where e.patient_id = "patients"."id")`,
    })
    .from(patients)
    .where(and(isNull(patients.removedAt), raw ? or(ilike(patients.lastName, `${raw}%`), eq(patients.accountNumber, raw)) : undefined))
    .orderBy(asc(patients.lastName))
    .limit(200);
  const out = [];
  for (const r of rows) out.push({ ...r, missingDocuments: (await documentChecklist(req.tenant!, r.id)).missingCount });
  await audit(req, { action: "search", entityType: "portal.patients", details: `${out.length} results` });
  res.json(out);
});

clientPortal.get("/patients/:id", async (req, res) => {
  const id = idOf(req.params.id);
  const [p] = await req.tenant!.db.select().from(patients).where(and(eq(patients.id, id), isNull(patients.removedAt)));
  if (!p) throw new HttpError(404, "Patient not found");
  const ins = await req.tenant!.db.select().from(patientInsurances).where(eq(patientInsurances.patientId, id)).orderBy(asc(patientInsurances.rank));
  await audit(req, { action: "view", entityType: "portal.patient", entityId: id, patientId: id });
  res.json({
    id: p.id, accountNumber: p.accountNumber, lastName: p.lastName, firstName: p.firstName, dob: p.dob, coverageType: p.coverageType,
    insurances: ins.map((i) => ({ rank: i.rank, payerName: i.payerName, payerType: i.payerType, claimNumber: i.claimNumber })),
    claims: await claimSummaries(req, id),
    checklist: await documentChecklist(req.tenant!, id),
  });
});

/** Clients send paperwork straight into Caliber's intake inbox. */
clientPortal.post("/uploads", requirePermission("portal.client.upload"), upload.array("files", 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "Choose a PDF or image to upload (PDF, PNG, JPG, TIFF, HEIC, WEBP up to 25 MB).");
  let suggested: number | null = null;
  if (req.body.patientId) {
    const [p] = await req.tenant!.db.select().from(patients).where(and(eq(patients.id, idOf(req.body.patientId)), isNull(patients.removedAt)));
    if (!p) throw new HttpError(404, "Patient not found");
    suggested = p.id;
  }
  const item = await createIntake(req, files, { source: "client_portal", sender: req.user!.email, subject: String(req.body.note ?? "").slice(0, 200) || null, suggestedPatientId: suggested, createdBy: req.user!.initials });
  await audit(req, { action: "create", entityType: "intake", entityId: item.id, details: `${files.length} files via client portal` });
  res.status(201).json({ id: item.id });
});

clientPortal.get("/uploads", async (req, res) => {
  const rows = await req.tenant!.db.select({ id: intakeItems.id, receivedAt: intakeItems.receivedAt, status: intakeItems.status, subject: intakeItems.subject, sender: intakeItems.sender }).from(intakeItems).where(eq(intakeItems.source, "client_portal")).orderBy(desc(intakeItems.receivedAt)).limit(100);
  res.json(rows.map((r) => ({ ...r, statusText: r.status === "done" ? "Filed" : r.status === "rejected" ? "Not filed: Caliber will contact you" : "Received, being processed" })));
});

// Client admins manage their own portal users (only within their own client).
clientPortal.get("/users", requirePermission("portal.client.users"), async (req, res) => {
  const rows = await getControlDb().select().from(users).where(and(eq(users.userType, "client_portal"), eq(users.portalClientId, req.tenant!.clientId))).orderBy(asc(users.name));
  res.json(rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role as Role], active: u.active })));
});
clientPortal.post("/users", requirePermission("portal.client.users"), async (req, res) => {
  const input = z.object({ email: z.string().trim().toLowerCase().email().max(120), name: z.string().trim().min(1).max(80), role: z.enum(CLIENT_PORTAL_ROLES) }).strict().parse(req.body);
  const db = getControlDb();
  const [exists] = await db.select().from(users).where(eq(users.email, input.email));
  if (exists) throw new HttpError(409, "Someone already uses that email");
  const password = tempPassword();
  const initials = input.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "CU";
  const [u] = await db.insert(users).values({ ...input, initials, userType: "client_portal", portalClientId: req.tenant!.clientId, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true }).returning();
  await db.insert(loginAudit).values({ email: u.email, userId: req.user!.id, event: `user_created:${u.id}` });
  res.status(201).json({ id: u.id, temporaryPassword: password });
});
clientPortal.patch("/users/:userId", requirePermission("portal.client.users"), async (req, res) => {
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, idOf(req.params.userId)));
  if (!u || u.userType !== "client_portal" || u.portalClientId !== req.tenant!.clientId) throw new HttpError(404, "User not found");
  if (u.id === req.user!.id) throw new HttpError(400, "You can't change your own account here");
  const input = z.object({ active: z.boolean().optional(), role: z.enum(CLIENT_PORTAL_ROLES).optional() }).strict().parse(req.body);
  await db.update(users).set({ ...input, ...(input.active === false ? { deactivatedAt: new Date() } : {}) }).where(eq(users.id, u.id));
  res.json({ ok: true });
});

// ---- Patient portal ---------------------------------------------------------------------

const myId = (req: Request) => {
  const id = req.user!.portalPatientId;
  if (!id) throw new HttpError(403, "This account isn't linked to a patient");
  return id;
};

patientPortal.get("/summary", async (req, res) => {
  const id = myId(req);
  const [p] = await req.tenant!.db.select().from(patients).where(and(eq(patients.id, id), isNull(patients.removedAt)));
  if (!p) throw new HttpError(404, "Account not found");
  const [c] = await getControlDb().select().from(clients).where(eq(clients.id, req.tenant!.clientId));
  const ins = await req.tenant!.db.select().from(patientInsurances).where(eq(patientInsurances.patientId, id)).orderBy(asc(patientInsurances.rank));
  const entries = await req.tenant!.db.select().from(ledgerEntries).where(eq(ledgerEntries.patientId, id));
  const uploads = await req.tenant!.db.select().from(documents).where(and(eq(documents.patientId, id), eq(documents.source, "patient_portal"), isNull(documents.removedAt))).orderBy(desc(documents.receivedAt));
  const pending = await req.tenant!.db.select().from(intakeItems).where(and(eq(intakeItems.suggestedPatientId, id), inArray(intakeItems.status, ["reading", "review"])));
  await audit(req, { action: "view", entityType: "portal.self", patientId: id });
  res.json({
    supplierName: c?.name,
    firstName: p.firstName,
    lastName: p.lastName,
    accountNumber: p.accountNumber,
    insurances: ins.map((i) => ({ rank: i.rank, payerName: i.payerName })),
    claims: await claimSummaries(req, id),
    youOweCents: sumCents(entries.map((e) => e.patientDeltaCents)),
    uploads: uploads.map((d) => ({ id: d.id, type: docTypeLabel(d.docType), receivedAt: d.receivedAt })),
    uploadsInReview: pending.length,
  });
});

patientPortal.post("/uploads", upload.array("files", 10), async (req, res) => {
  const id = myId(req);
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "Choose a photo or PDF to upload.");
  const item = await createIntake(req, files, { source: "patient_portal", sender: "Patient portal", subject: String(req.body.note ?? "").slice(0, 200) || null, suggestedPatientId: id, createdBy: req.user!.initials });
  await audit(req, { action: "create", entityType: "intake", entityId: item.id, patientId: id, details: "patient portal upload" });
  res.status(201).json({ ok: true });
});

/** A message to the billing office: becomes an account note and a follow-up on the Call List. */
patientPortal.post("/messages", async (req, res) => {
  const id = myId(req);
  const { body } = z.object({ body: z.string().trim().min(2).max(2000) }).strict().parse(req.body);
  await req.tenant!.db.insert(notes).values({ patientId: id, body: `Message from patient portal:\n${body}`, category: "portal", createdBy: req.user!.initials });
  await req.tenant!.db.insert(tasks).values({ patientId: id, title: "Reply to patient portal message", dueDate: todayIso(), createdBy: req.user!.initials });
  await audit(req, { action: "create", entityType: "portal.message", patientId: id });
  publish(req.tenant!.clientId, { kind: "notes", patientId: id });
  publish(req.tenant!.clientId, { kind: "tasks", patientId: id });
  res.status(201).json({ ok: true });
});

// ---- Inbound API (fax/email gateways, CENCOM). The API key decides the client. --------

portalRouter.post("/api/inbound/paperwork", async (req, res, next) => {
  const header = req.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw) throw new HttpError(401, "Missing API key");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const db = getControlDb();
  const [k] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)));
  if (!k) throw new HttpError(401, "Invalid API key");
  const [c] = await db.select().from(clients).where(eq(clients.id, k.clientId));
  if (!c || c.status !== "active") throw new HttpError(403, "Client not active");
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
  req.tenant = await getTenant(c.id, c.slug);
  // An API caller acts as a system user for the audit trail.
  req.user = { id: 0, email: `api-key:${k.prefix}`, name: k.name, initials: "API", role: "api", userType: "api", portalClientId: c.id, portalPatientId: null, mustChangePassword: false };
  next();
}, upload.array("files", 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "No supported files (PDF, PNG, JPG, TIFF, HEIC, WEBP up to 25 MB)");
  const source = ["fax", "email", "api"].includes(req.body.source) ? req.body.source : "api";
  const item = await createIntake(req, files, { source, sender: String(req.body.sender ?? "").slice(0, 120) || null, subject: String(req.body.subject ?? "").slice(0, 200) || null, createdBy: "API" });
  await audit(req, { action: "create", entityType: "intake", entityId: item.id, details: `${files.length} files via API (${source})` });
  res.status(201).json({ intakeId: item.id, status: "received" });
});
