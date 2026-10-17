// Users & permissions, "View as", passwords, and Settings (everything Caliber can customize).
import { Router, type Request } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { apiKeys, clients, documentRequirements, hcpcsCodes, icd10Codes, loginAudit, modifiers, noteTemplates, payers, picklistItems, userClientAssignments, users } from "@shared/schema/control";
import { clientSettings, facilities, providers } from "@shared/schema/tenant";
import { PAYER_TYPES } from "@shared/picklists";
import { DOC_TYPES } from "@shared/documents";
import { ROLE_LABELS, rolesAssignableBy, type Role } from "@shared/permissions";
import { getControlDb } from "../db/control";
import { LISTS, listItems, type ListName } from "../lib/lists";
import { codeSetStatus, updateFromOfficialSources } from "../lib/codesets";
import { codeSearch } from "./codes";
import { todayIso } from "@shared/dates";
import { HttpError, audit, requireAuth, requireClient, requirePermission, userCanAccessClient } from "../middleware";
import { loadPatientOr404 } from "./patients";

export const adminRouter = Router();

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

export function tempPassword() {
  return `Temp-${crypto.randomBytes(6).toString("base64url")}`;
}

const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number")
  .refine((p) => p === p.trim(), "Don't start or end the password with a space");

// ---- Passwords ------------------------------------------------------------------------

adminRouter.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().trim().min(1), newPassword: strongPassword }).strict().parse(req.body);
  if (req.realUser) throw new HttpError(403, "Not while viewing as someone else");
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (!u || !(await bcrypt.compare(currentPassword, u.passwordHash))) throw new HttpError(400, "Your current password isn't right");
  if (currentPassword === newPassword) throw new HttpError(400, "Pick a different password");
  await db.update(users).set({ passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false }).where(eq(users.id, u.id));
  await db.insert(loginAudit).values({ email: u.email, userId: u.id, event: "password_changed" });
  res.json({ ok: true });
});

// ---- Users ----------------------------------------------------------------------------

/** Which clients can this manager manage? Owner: all. Manager: the ones they're assigned to. */
async function managedClientIds(req: Request): Promise<number[]> {
  const db = getControlDb();
  if (req.user!.role === "owner") return (await db.select().from(clients)).map((c) => c.id);
  return (await db.select().from(userClientAssignments).where(eq(userClientAssignments.userId, req.user!.id))).map((a) => a.clientId);
}

async function userClientIds(u: typeof users.$inferSelect): Promise<number[]> {
  if (u.userType !== "staff") return u.portalClientId ? [u.portalClientId] : [];
  return (await getControlDb().select().from(userClientAssignments).where(eq(userClientAssignments.userId, u.id))).map((a) => a.clientId);
}

/** A manager may only manage users who sit entirely inside their clients and below their level. */
async function assertCanManage(req: Request, target: typeof users.$inferSelect) {
  if (req.user!.role === "owner") return;
  if (target.role === "owner" || target.role === "billing_manager") throw new HttpError(403, "Only the owner can change managers");
  const mine = new Set(await managedClientIds(req));
  const theirs = await userClientIds(target);
  if (theirs.some((c) => !mine.has(c))) throw new HttpError(403, "That person works in a client you don't manage");
}

adminRouter.get("/api/admin/users", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const db = getControlDb();
  const mine = new Set(await managedClientIds(req));
  const all = await db.select().from(users).orderBy(asc(users.name));
  const assigns = await db.select().from(userClientAssignments);
  const cl = await db.select().from(clients);
  const out = [];
  for (const u of all) {
    const ids = u.userType === "staff" ? assigns.filter((a) => a.userId === u.id).map((a) => a.clientId) : u.portalClientId ? [u.portalClientId] : [];
    const visible = req.user!.role === "owner" || (u.role !== "owner" && ids.length > 0 && ids.every((c) => mine.has(c))) || u.id === req.user!.id;
    if (!visible) continue;
    out.push({
      id: u.id, email: u.email, name: u.name, initials: u.initials, userType: u.userType, role: u.role, roleLabel: ROLE_LABELS[u.role as Role] ?? u.role,
      active: u.active, mustChangePassword: u.mustChangePassword, createdAt: u.createdAt, portalPatientId: u.portalPatientId,
      clients: ids.map((id) => ({ id, name: cl.find((c) => c.id === id)?.name ?? `#${id}` })),
    });
  }
  res.json({ users: out, assignableRoles: rolesAssignableBy(req.user!.role).map((r) => ({ code: r, label: ROLE_LABELS[r] })), clients: cl.filter((c) => mine.has(c.id)).map((c) => ({ id: c.id, name: c.name })) });
});

const userInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(120),
    name: z.string().trim().min(1).max(80),
    initials: z.string().trim().toUpperCase().min(2).max(4),
    role: z.string(),
    clientIds: z.array(z.number().int().positive()).default([]),
  })
  .strict();

const userTypeFor = (role: string) => (["client_admin", "client_user"].includes(role) ? "client_portal" : role === "patient" ? "patient_portal" : "staff");

async function checkRoleAndClients(req: Request, role: string, clientIds: number[]) {
  if (!rolesAssignableBy(req.user!.role).includes(role as Role)) throw new HttpError(403, "You can't give that role");
  if (role === "patient") throw new HttpError(400, "Invite patients from their account page");
  const mine = new Set(await managedClientIds(req));
  if (clientIds.some((c) => !mine.has(c))) throw new HttpError(403, "You can only assign clients you manage");
  if (userTypeFor(role) === "client_portal" && clientIds.length !== 1) throw new HttpError(400, "A client portal user belongs to exactly one client");
}

adminRouter.post("/api/admin/users", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const input = userInput.parse(req.body);
  await checkRoleAndClients(req, input.role, input.clientIds);
  const db = getControlDb();
  const [exists] = await db.select().from(users).where(eq(users.email, input.email));
  if (exists) throw new HttpError(409, "Someone already uses that email");
  const password = tempPassword();
  const type = userTypeFor(input.role);
  const [u] = await db
    .insert(users)
    .values({
      email: input.email, name: input.name, initials: input.initials, role: input.role, userType: type,
      portalClientId: type === "client_portal" ? input.clientIds[0] : null, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true,
    })
    .returning();
  if (type === "staff" && input.clientIds.length) await db.insert(userClientAssignments).values(input.clientIds.map((clientId) => ({ userId: u.id, clientId })));
  await db.insert(loginAudit).values({ email: u.email, userId: req.user!.id, event: `user_created:${u.id}` });
  res.status(201).json({ id: u.id, temporaryPassword: password });
});

adminRouter.patch("/api/admin/users/:userId", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, idOf(req.params.userId)));
  if (!u) throw new HttpError(404, "User not found");
  await assertCanManage(req, u);
  const input = z.object({ name: z.string().trim().min(1).max(80).optional(), initials: z.string().trim().toUpperCase().min(2).max(4).optional(), role: z.string().optional(), active: z.boolean().optional(), clientIds: z.array(z.number().int().positive()).optional() }).strict().parse(req.body);
  if (u.id === req.user!.id && (input.active === false || (input.role && input.role !== u.role))) throw new HttpError(400, "You can't change your own role or deactivate yourself");
  const role = input.role ?? u.role;
  if (input.role || input.clientIds) await checkRoleAndClients(req, role, input.clientIds ?? (await userClientIds(u)));
  if (input.role && userTypeFor(input.role) !== u.userType) throw new HttpError(400, "Can't switch between staff and portal users. Create a new account instead.");
  await db
    .update(users)
    .set({
      ...(input.name ? { name: input.name } : {}), ...(input.initials ? { initials: input.initials } : {}), ...(input.role ? { role: input.role } : {}),
      ...(input.active !== undefined ? { active: input.active, deactivatedAt: input.active ? null : new Date() } : {}),
      ...(input.clientIds && u.userType === "client_portal" ? { portalClientId: input.clientIds[0] } : {}),
    })
    .where(eq(users.id, u.id));
  if (input.clientIds && u.userType === "staff") {
    await db.delete(userClientAssignments).where(eq(userClientAssignments.userId, u.id));
    if (input.clientIds.length) await db.insert(userClientAssignments).values(input.clientIds.map((clientId) => ({ userId: u.id, clientId })));
  }
  await db.insert(loginAudit).values({ email: u.email, userId: req.user!.id, event: `user_updated:${u.id}:${Object.keys(input).join(",")}` });
  res.json({ ok: true });
});

adminRouter.post("/api/admin/users/:userId/reset-password", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, idOf(req.params.userId)));
  if (!u) throw new HttpError(404, "User not found");
  await assertCanManage(req, u);
  const password = tempPassword();
  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true }).where(eq(users.id, u.id));
  await db.insert(loginAudit).values({ email: u.email, userId: req.user!.id, event: `password_reset:${u.id}` });
  res.json({ temporaryPassword: password });
});

// ---- View as (read-only) --------------------------------------------------------------

adminRouter.post("/api/session/view-as", requireAuth, requirePermission("users.view_as"), async (req, res) => {
  if (req.realUser) throw new HttpError(400, "Leave the current “View as” first");
  const { userId, reason } = z.object({ userId: z.number().int().positive(), reason: z.string().trim().min(5, "Say why (at least 5 characters)").max(200) }).strict().parse(req.body);
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) throw new HttpError(404, "User not found");
  if (u.id === req.user!.id) throw new HttpError(400, "That's you");
  await assertCanManage(req, u);
  req.session.viewAsUserId = u.id;
  req.session.viewAsReason = reason;
  // Keep the same client if they can see it; otherwise they'll pick one of theirs.
  if (u.userType !== "staff") req.session.activeClientId = u.portalClientId ?? undefined;
  else if (req.session.activeClientId && !(await userCanAccessClient(u.id, req.session.activeClientId))) req.session.activeClientId = undefined;
  await db.insert(loginAudit).values({ email: req.user!.email, userId: req.user!.id, event: `view_as_start:${u.id}:${reason.slice(0, 120)}` });
  res.json({ ok: true });
});

adminRouter.delete("/api/session/view-as", requireAuth, async (req, res) => {
  if (req.realUser) {
    await getControlDb().insert(loginAudit).values({ email: req.realUser.email, userId: req.realUser.id, event: `view_as_stop:${req.user!.id}` });
    if (req.user!.userType !== "staff") req.session.activeClientId = undefined;
  }
  req.session.viewAsUserId = undefined;
  req.session.viewAsReason = undefined;
  res.json({ ok: true });
});

// ---- Patient portal invites ------------------------------------------------------------

adminRouter.post("/api/patients/:id/portal-invite", requireAuth, requireClient, requirePermission("portal.invite"), async (req, res) => {
  const id = idOf(req.params.id);
  const p = await loadPatientOr404(req, id);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(120) }).strict().parse(req.body);
  const db = getControlDb();
  const [exists] = await db.select().from(users).where(eq(users.email, email));
  if (exists) throw new HttpError(409, "Someone already uses that email");
  const password = tempPassword();
  const [u] = await db
    .insert(users)
    .values({ email, name: `${p.firstName} ${p.lastName}`, initials: `${p.firstName[0] ?? "P"}${p.lastName[0] ?? "T"}`, role: "patient", userType: "patient_portal", portalClientId: req.tenant!.clientId, portalPatientId: id, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
    .returning();
  await audit(req, { action: "create", entityType: "patient.portal_account", entityId: u.id, patientId: id });
  res.status(201).json({ email, temporaryPassword: password });
});

// ---- Settings: shared lists (control DB, no PHI) --------------------------------------

const settings = Router();
settings.use(requireAuth, requirePermission("settings.manage"));
adminRouter.use("/api/settings", settings);

// Readable by every staff member (templates and drop-downs are used on the work screens).
adminRouter.get("/api/note-templates", requireAuth, async (_req, res) => {
  res.json(await getControlDb().select().from(noteTemplates).where(eq(noteTemplates.active, true)).orderBy(asc(noteTemplates.sortOrder), asc(noteTemplates.name)));
});
adminRouter.get("/api/lists/:list", requireAuth, async (req, res) => {
  if (!(String(req.params.list) in LISTS)) throw new HttpError(404, "Unknown list");
  res.json(await listItems(String(req.params.list) as ListName));
});

const templateInput = z.object({ name: z.string().trim().min(1).max(80), category: z.string().trim().min(1).max(30), body: z.string().trim().min(1).max(4000), followUpDays: z.number().int().min(0).max(365).nullable().optional(), active: z.boolean().optional(), sortOrder: z.number().int().optional() }).strict();
settings.get("/templates", async (_req, res) => res.json(await getControlDb().select().from(noteTemplates).orderBy(asc(noteTemplates.sortOrder), asc(noteTemplates.name))));
settings.post("/templates", async (req, res) => {
  const [r] = await getControlDb().insert(noteTemplates).values({ ...templateInput.parse(req.body), updatedBy: req.user!.initials }).returning();
  res.status(201).json(r);
});
settings.patch("/templates/:tid", async (req, res) => {
  const [r] = await getControlDb().update(noteTemplates).set({ ...templateInput.partial().parse(req.body), updatedAt: new Date(), updatedBy: req.user!.initials }).where(eq(noteTemplates.id, idOf(req.params.tid))).returning();
  if (!r) throw new HttpError(404, "Not found");
  res.json(r);
});
settings.delete("/templates/:tid", async (req, res) => {
  await getControlDb().delete(noteTemplates).where(eq(noteTemplates.id, idOf(req.params.tid)));
  res.json({ ok: true });
});

settings.get("/lists", async (_req, res) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(LISTS)) out[k] = { label: v.label, items: await listItems(k as ListName, true) };
  res.json(out);
});
settings.post("/lists/:list", async (req, res) => {
  if (!(req.params.list in LISTS)) throw new HttpError(404, "Unknown list");
  const { code, label } = z.object({ code: z.string().trim().toUpperCase().min(1).max(20), label: z.string().trim().min(1).max(60) }).strict().parse(req.body);
  const existing = await listItems(req.params.list as ListName, true);
  if (existing.some((e) => e.code.toUpperCase() === code)) throw new HttpError(409, "That code is already used in this list");
  const [r] = await getControlDb().insert(picklistItems).values({ list: req.params.list, code: req.params.list === "note_category" ? code.toLowerCase() : code, label, sortOrder: existing.length }).returning();
  res.status(201).json(r);
});
// Items are deactivated rather than deleted, because old entries still point at them.
settings.patch("/lists/items/:itemId", async (req, res) => {
  const input = z.object({ label: z.string().trim().min(1).max(60).optional(), active: z.boolean().optional(), sortOrder: z.number().int().optional() }).strict().parse(req.body);
  const [r] = await getControlDb().update(picklistItems).set(input).where(eq(picklistItems.id, idOf(req.params.itemId))).returning();
  if (!r) throw new HttpError(404, "Not found");
  res.json(r);
});

// Code sets
const codeTables = { hcpcs: hcpcsCodes, icd10: icd10Codes, modifiers } as const;
settings.get("/codes/:kind", async (req, res) => {
  const kind = req.params.kind as keyof typeof codeTables;
  if (!(kind in codeTables)) throw new HttpError(404, "Unknown code set");
  const q = typeof req.query.q === "string" ? req.query.q.trim().replace(/[%_\\]/g, "").slice(0, 60) : "";
  const db = getControlDb();
  if (kind === "modifiers") return res.json(await db.select().from(modifiers).where(q ? or(ilike(modifiers.code, `${q}%`), ilike(modifiers.description, `%${q}%`)) : undefined).orderBy(asc(modifiers.code)));
  // Settings shows retired codes too (with their end dates), so all=true.
  if (kind === "hcpcs") {
    const s = codeSearch({ code: hcpcsCodes.code, texts: [hcpcsCodes.shortDescription, hcpcsCodes.longDescription], from: hcpcsCodes.effectiveFrom, to: hcpcsCodes.effectiveTo }, q, todayIso(), true);
    return res.json(await db.select().from(hcpcsCodes).where(s.where).orderBy(s.order, asc(hcpcsCodes.code)).limit(200));
  }
  const s = codeSearch({ code: icd10Codes.code, texts: [icd10Codes.description, icd10Codes.shortDescription], from: icd10Codes.effectiveFrom, to: icd10Codes.effectiveTo }, q, todayIso(), true);
  res.json(await db.select().from(icd10Codes).where(s.where).orderBy(s.order, asc(icd10Codes.code), asc(icd10Codes.effectiveFrom)).limit(200));
});

// Official code-set files: what's loaded, and fetching updates from CMS / CDC (runs in the background).
const codeUpdate = { running: false, log: [] as string[], error: null as string | null, finishedAt: null as string | null };
settings.get("/code-sets", async (_req, res) => res.json({ ...(await codeSetStatus()), update: codeUpdate }));
settings.post("/code-sets/update", async (req, res) => {
  if (!codeUpdate.running) {
    Object.assign(codeUpdate, { running: true, log: [], error: null, finishedAt: null });
    const who = `${req.user!.name} (${req.user!.initials})`;
    void updateFromOfficialSources(who, (m) => codeUpdate.log.push(m))
      .catch((e: Error) => { codeUpdate.error = `The update stopped: ${e.message}. Nothing partial was saved for that file.`; })
      .finally(() => Object.assign(codeUpdate, { running: false, finishedAt: new Date().toISOString() }));
  }
  res.status(202).json({ update: codeUpdate });
});

const codeInput = z.object({ code: z.string().trim().toUpperCase().min(2).max(10), description: z.string().trim().min(1).max(300), effectiveFrom: z.string().optional(), effectiveTo: z.string().nullable().optional() }).strict();
settings.post("/codes/:kind", async (req, res) => {
  const kind = req.params.kind;
  const input = codeInput.parse(req.body);
  const source = `Added in Settings by ${req.user!.initials}`;
  const db = getControlDb();
  if (kind === "modifiers") {
    if (!/^[A-Z0-9]{2}$/.test(input.code)) throw new HttpError(400, "Modifiers are 2 characters");
    return res.status(201).json((await db.insert(modifiers).values({ code: input.code, description: input.description, source }).returning())[0]);
  }
  if (kind === "hcpcs") {
    if (!/^[A-Z]\d{4}$/.test(input.code)) throw new HttpError(400, "HCPCS codes look like E0218");
    return res.status(201).json((await db.insert(hcpcsCodes).values({ code: input.code, shortDescription: input.description, effectiveFrom: input.effectiveFrom ?? null, source }).returning())[0]);
  }
  if (kind === "icd10") {
    if (!/^[A-Z][0-9A-Z][0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(input.code)) throw new HttpError(400, "ICD-10 codes look like M25.561");
    return res.status(201).json((await db.insert(icd10Codes).values({ code: input.code, description: input.description, effectiveFrom: input.effectiveFrom ?? null, source }).returning())[0]);
  }
  throw new HttpError(404, "Unknown code set");
});
// Codes are never deleted (old claims need them). Retire one by giving it an end date.
settings.patch("/codes/:kind/:codeId", async (req, res) => {
  const kind = req.params.kind;
  const input = z.object({ description: z.string().trim().min(1).max(300).optional(), effectiveTo: z.string().nullable().optional() }).strict().parse(req.body);
  const db = getControlDb();
  const id = idOf(req.params.codeId);
  // Official CMS / CDC codes only change through a new official file.
  const table = kind === "hcpcs" ? hcpcsCodes : kind === "icd10" ? icd10Codes : modifiers;
  const [row] = await db.select({ source: table.source }).from(table).where(eq(table.id, id));
  if (!row) throw new HttpError(404, "Code not found");
  if (/^(CMS|CDC)/.test(row.source)) throw new HttpError(400, "Official codes come from the CMS / CDC files and can't be changed by hand.");
  if (kind === "hcpcs") await db.update(hcpcsCodes).set({ ...(input.description ? { shortDescription: input.description } : {}), ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}) }).where(eq(hcpcsCodes.id, id));
  else if (kind === "icd10") await db.update(icd10Codes).set({ ...(input.description ? { description: input.description } : {}), ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}) }).where(eq(icd10Codes.id, id));
  else if (kind === "modifiers" && input.description) await db.update(modifiers).set({ description: input.description }).where(eq(modifiers.id, id));
  else throw new HttpError(400, "Nothing to change");
  res.json({ ok: true });
});

// Payers
const payerInput = z.object({ name: z.string().trim().min(2).max(100), payerType: z.enum(PAYER_TYPES.map((p) => p.code) as [string, ...string[]]), state: z.string().trim().max(2).nullable().optional(), address1: z.string().trim().max(100).nullable().optional(), city: z.string().trim().max(60).nullable().optional(), zip: z.string().trim().max(10).nullable().optional(), phone: z.string().trim().max(20).nullable().optional(), electronicPayerId: z.string().trim().max(20).nullable().optional(), notes: z.string().trim().max(300).nullable().optional(), active: z.boolean().optional() }).strict();
settings.get("/payers", async (_req, res) => res.json(await getControlDb().select().from(payers).orderBy(asc(payers.name))));
settings.post("/payers", async (req, res) => res.status(201).json((await getControlDb().insert(payers).values(payerInput.parse(req.body)).returning())[0]));
settings.patch("/payers/:pid", async (req, res) => {
  const [r] = await getControlDb().update(payers).set(payerInput.partial().parse(req.body)).where(eq(payers.id, idOf(req.params.pid))).returning();
  if (!r) throw new HttpError(404, "Not found");
  res.json(r);
});

// Document requirements per payer type
settings.get("/requirements", async (_req, res) => res.json(await getControlDb().select().from(documentRequirements).orderBy(asc(documentRequirements.payerType), asc(documentRequirements.docType))));
settings.post("/requirements", async (req, res) => {
  const input = z.object({ payerType: z.enum(PAYER_TYPES.map((p) => p.code) as [string, ...string[]]), docType: z.enum(DOC_TYPES.map((d) => d.code) as [string, ...string[]]), required: z.boolean() }).strict().parse(req.body);
  const db = getControlDb();
  const [cur] = await db.select().from(documentRequirements).where(and(eq(documentRequirements.payerType, input.payerType), eq(documentRequirements.docType, input.docType)));
  if (cur) await db.update(documentRequirements).set({ required: input.required, source: `Changed in Settings by ${req.user!.initials}` }).where(eq(documentRequirements.id, cur.id));
  else await db.insert(documentRequirements).values({ ...input, source: `Added in Settings by ${req.user!.initials}` });
  res.json({ ok: true });
});

// ---- Settings that belong to the current client (tenant DB) ---------------------------

const clientSettingsRouter = Router();
clientSettingsRouter.use(requireAuth, requireClient);
adminRouter.use("/api/client-settings", clientSettingsRouter);

clientSettingsRouter.get("/providers", async (req, res) => res.json(await req.tenant!.db.select().from(providers).orderBy(asc(providers.name))));
clientSettingsRouter.get("/facilities", async (req, res) => res.json(await req.tenant!.db.select().from(facilities).orderBy(asc(facilities.name))));
const providerInput = z.object({ kind: z.enum(["rendering", "billing", "ordering", "referring"]), name: z.string().trim().min(2).max(100), npi: z.string().trim().regex(/^\d{10}$/, "NPI is 10 digits").nullable().optional(), taxonomy: z.string().trim().max(20).nullable().optional(), phone: z.string().trim().max(20).nullable().optional(), active: z.boolean().optional() }).strict();
const facilityInput = z.object({ name: z.string().trim().min(2).max(100), address1: z.string().trim().max(100).nullable().optional(), city: z.string().trim().max(60).nullable().optional(), state: z.string().trim().max(2).nullable().optional(), zip: z.string().trim().max(10).nullable().optional(), npi: z.string().trim().regex(/^\d{10}$/, "NPI is 10 digits").nullable().optional(), active: z.boolean().optional() }).strict();
clientSettingsRouter.post("/providers", requirePermission("settings.manage"), async (req, res) => res.status(201).json((await req.tenant!.db.insert(providers).values(providerInput.parse(req.body)).returning())[0]));
clientSettingsRouter.patch("/providers/:pid", requirePermission("settings.manage"), async (req, res) => res.json((await req.tenant!.db.update(providers).set(providerInput.partial().parse(req.body)).where(eq(providers.id, idOf(req.params.pid))).returning())[0] ?? null));
clientSettingsRouter.post("/facilities", requirePermission("settings.manage"), async (req, res) => res.status(201).json((await req.tenant!.db.insert(facilities).values(facilityInput.parse(req.body)).returning())[0]));
clientSettingsRouter.patch("/facilities/:fid", requirePermission("settings.manage"), async (req, res) => res.json((await req.tenant!.db.update(facilities).set(facilityInput.partial().parse(req.body)).where(eq(facilities.id, idOf(req.params.fid))).returning())[0] ?? null));

const companyInput = z.object({ legalName: z.string().trim().max(120).optional(), billingNpi: z.string().trim().regex(/^\d{10}$/, "NPI is 10 digits").or(z.literal("")).optional(), taxId: z.string().trim().max(20).optional(), phone: z.string().trim().max(20).optional(), address: z.string().trim().max(200).optional(), ledgerColors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional() }).strict();
clientSettingsRouter.get("/company", async (req, res) => {
  const rows = await req.tenant!.db.select().from(clientSettings);
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
clientSettingsRouter.put("/company", requirePermission("settings.manage"), async (req, res) => {
  const input = companyInput.parse(req.body);
  for (const [key, value] of Object.entries(input)) {
    await req.tenant!.db.insert(clientSettings).values({ key, value, updatedBy: req.user!.initials }).onConflictDoUpdate({ target: clientSettings.key, set: { value, updatedAt: new Date(), updatedBy: req.user!.initials } });
  }
  await audit(req, { action: "update", entityType: "client_settings", details: Object.keys(input).join(",") });
  res.json({ ok: true });
});

// API keys for this client (CENCOM, fax/email gateway). The full key is shown once, then only a hash is kept.
clientSettingsRouter.get("/api-keys", requirePermission("settings.manage"), async (req, res) => {
  const rows = await getControlDb().select().from(apiKeys).where(eq(apiKeys.clientId, req.tenant!.clientId)).orderBy(asc(apiKeys.createdAt));
  res.json(rows.map(({ keyHash: _h, ...r }) => r));
});
clientSettingsRouter.post("/api-keys", requirePermission("settings.manage"), async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(2).max(60) }).strict().parse(req.body);
  const raw = `cdb_${crypto.randomBytes(24).toString("base64url")}`;
  const [r] = await getControlDb().insert(apiKeys).values({ clientId: req.tenant!.clientId, name, prefix: raw.slice(0, 10), keyHash: crypto.createHash("sha256").update(raw).digest("hex"), createdBy: req.user!.id }).returning();
  await audit(req, { action: "create", entityType: "api_key", entityId: r.id });
  res.status(201).json({ id: r.id, name, key: raw });
});
clientSettingsRouter.delete("/api-keys/:kid", requirePermission("settings.manage"), async (req, res) => {
  await getControlDb().update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, idOf(req.params.kid)), eq(apiKeys.clientId, req.tenant!.clientId), isNull(apiKeys.revokedAt)));
  await audit(req, { action: "remove", entityType: "api_key", entityId: String(req.params.kid) });
  res.json({ ok: true });
});

