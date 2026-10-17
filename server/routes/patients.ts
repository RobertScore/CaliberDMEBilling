// Patient registration, notes and alerts. Everything here runs inside ONE client's database (req.tenant).
import { Router, type Request } from "express";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { alerts, notes, patientInsurances, patients, tasks } from "@shared/schema/tenant";
import { payers, users } from "@shared/schema/control";
import { alertInput, noteInput, patientInput, type PatientInput } from "@shared/validation";
import { getControlDb } from "../db/control";
import { decryptField, encryptField, last4 } from "../lib/crypto";
import { HttpError, audit, requireAuth, requireClient, requirePermission, userCanAccessClient } from "../middleware";
import { findItem } from "../lib/lists";
import { publish } from "../lib/events";

export const patientsRouter = Router();
patientsRouter.use("/api/patients", requireAuth, requireClient);

function idParam(req: Request, name = "id"): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
}

export async function loadPatientOr404(req: Request, id: number) {
  const [p] = await req.tenant!.db.select().from(patients).where(and(eq(patients.id, id), isNull(patients.removedAt)));
  if (!p) throw new HttpError(404, "Patient not found");
  return p;
}

/** Shape sent to the screen: SSN and member IDs masked (last 4 only). */
export async function patientView(req: Request, id: number) {
  const p = await loadPatientOr404(req, id);
  const ins = await req.tenant!.db
    .select()
    .from(patientInsurances)
    .where(eq(patientInsurances.patientId, id))
    .orderBy(asc(patientInsurances.rank));
  const { ssnEncrypted: _s, ...rest } = p;
  return {
    ...rest,
    ssnMasked: p.ssnLast4 ? `***-**-${p.ssnLast4}` : null,
    insurances: ins.map(({ memberIdEncrypted: _m, ...i }) => ({ ...i, memberIdMasked: i.memberIdLast4 ? `****${i.memberIdLast4}` : null })),
  };
}

async function resolvePayers(input: PatientInput) {
  const db = getControlDb();
  const out = new Map<number, { name: string; payerType: string }>();
  for (const i of input.insurances) {
    const [p] = await db.select().from(payers).where(eq(payers.id, i.payerId));
    if (!p) throw new HttpError(400, `Unknown payer #${i.payerId}`);
    out.set(i.payerId, { name: p.name, payerType: p.payerType });
  }
  const ranks = input.insurances.map((i) => i.rank);
  if (new Set(ranks).size !== ranks.length) throw new HttpError(400, "Each insurance needs a different rank (primary, secondary, tertiary)");
  return out;
}

function insuranceRows(req: Request, patientId: number, input: PatientInput, payerInfo: Map<number, { name: string; payerType: string }>) {
  return input.insurances.map((i) => {
    const { memberId, ...rest } = i;
    const info = payerInfo.get(i.payerId)!;
    return {
      ...rest,
      patientId,
      payerName: info.name,
      payerType: info.payerType,
      memberIdEncrypted: memberId ? encryptField(req.tenant!.key, memberId) : null,
      memberIdLast4: memberId ? last4(memberId) : null,
    };
  });
}

// Search (the magnifying glass). Returns only what's needed to pick a patient.
patientsRouter.get("/api/patients", requirePermission("patient.view"), async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50).replace(/[%_]/g, "") : "";
  const [last, first] = raw.split(",").map((s) => s.trim());
  const where = raw
    ? or(
        eq(patients.accountNumber, raw),
        and(ilike(patients.lastName, `${last}%`), first ? ilike(patients.firstName, `${first}%`) : undefined),
        // No comma: also try the first name, and "first last".
        raw.includes(",") ? undefined : ilike(patients.firstName, `${raw}%`),
        raw.includes(",") ? undefined : sql`(${patients.firstName} || ' ' || ${patients.lastName}) ilike ${`${raw}%`}`,
      )
    : undefined;
  const rows = await req.tenant!.db
    .select({
      id: patients.id,
      accountNumber: patients.accountNumber,
      lastName: patients.lastName,
      firstName: patients.firstName,
      dob: patients.dob,
      coverageType: patients.coverageType,
      balanceCents: sql<number>`coalesce((select sum(insurance_delta_cents + patient_delta_cents) from ledger_entries le where le.patient_id = "patients"."id"), 0)::int`,
    })
    .from(patients)
    .where(and(isNull(patients.removedAt), where))
    .orderBy(asc(patients.lastName), asc(patients.firstName))
    .limit(50);
  await audit(req, { action: "search", entityType: "patient", details: `${rows.length} results` });
  res.json(rows);
});

patientsRouter.get("/api/patients/:id", requirePermission("patient.view"), async (req, res) => {
  const id = idParam(req);
  const view = await patientView(req, id);
  await audit(req, { action: "view", entityType: "patient", entityId: id, patientId: id });
  res.json(view);
});

/** Create a patient in the current client. Used by Register patient and by intake. */
export async function createPatientRecord(req: Request, input: PatientInput) {
  const payerInfo = await resolvePayers(input);
  const db = req.tenant!.db;
  const { insurances: _i, ssn, ...fields } = input;
  const created = await db.transaction(async (tx) => {
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${patients.id}), 0) + 1` }).from(patients);
    const [p] = await tx
      .insert(patients)
      .values({
        ...fields,
        accountNumber: String(100000 + Number(next)),
        ssnEncrypted: ssn ? encryptField(req.tenant!.key, ssn) : null,
        ssnLast4: ssn ? last4(ssn) : null,
        createdBy: req.user!.initials,
      })
      .returning();
    const rows = insuranceRows(req, p.id, input, payerInfo);
    if (rows.length) await tx.insert(patientInsurances).values(rows);
    return p;
  });
  await audit(req, { action: "create", entityType: "patient", entityId: created.id, patientId: created.id });
  publish(req.tenant!.clientId, { kind: "patient", patientId: created.id });
  return created;
}

patientsRouter.post("/api/patients", requirePermission("patient.create"), async (req, res) => {
  const created = await createPatientRecord(req, patientInput.parse(req.body));
  res.status(201).json(await patientView(req, created.id));
});

/** Replace a patient's details and insurance. Keeps stored SSN / member IDs when sent back blank. */
export async function updatePatientRecord(req: Request, id: number, input: PatientInput, details: string) {
  await loadPatientOr404(req, id);
  const payerInfo = await resolvePayers(input);
  const db = req.tenant!.db;
  const { insurances: _i, ssn, ...fields } = input;
  // Keep the stored SSN / member ID if the screen sends them back blank (it only ever sees the masked value).
  const existingIns = await db.select().from(patientInsurances).where(eq(patientInsurances.patientId, id));
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({
        ...fields,
        ...(ssn ? { ssnEncrypted: encryptField(req.tenant!.key, ssn), ssnLast4: last4(ssn) } : {}),
        updatedAt: new Date(),
        updatedBy: req.user!.initials,
      })
      .where(eq(patients.id, id));
    await tx.delete(patientInsurances).where(eq(patientInsurances.patientId, id));
    const rows = insuranceRows(req, id, input, payerInfo).map((r) => {
      if (r.memberIdEncrypted) return r;
      const prev = existingIns.find((e) => e.rank === r.rank && e.payerId === r.payerId);
      return prev ? { ...r, memberIdEncrypted: prev.memberIdEncrypted, memberIdLast4: prev.memberIdLast4 } : r;
    });
    if (rows.length) await tx.insert(patientInsurances).values(rows);
  });
  await audit(req, { action: "update", entityType: "patient", entityId: id, patientId: id, details });
  publish(req.tenant!.clientId, { kind: "patient", patientId: id });
}

patientsRouter.put("/api/patients/:id", requirePermission("patient.edit"), async (req, res) => {
  const id = idParam(req);
  await updatePatientRecord(req, id, patientInput.parse(req.body), `fields: ${Object.keys(req.body).join(",")}`);
  res.json(await patientView(req, id));
});

// "ONLY MANAGEMENT HAS ACCESS TO REMOVE ANYTHING." Removal hides the patient; nothing is erased.
patientsRouter.delete("/api/patients/:id", requirePermission("patient.remove"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  await req.tenant!.db.update(patients).set({ removedAt: new Date(), removedBy: req.user!.initials }).where(eq(patients.id, id));
  await audit(req, { action: "remove", entityType: "patient", entityId: id, patientId: id });
  res.json({ ok: true });
});

patientsRouter.post("/api/patients/:id/reveal-ssn", requirePermission("ssn.reveal"), async (req, res) => {
  const id = idParam(req);
  const p = await loadPatientOr404(req, id);
  await audit(req, { action: "reveal", entityType: "patient.ssn", entityId: id, patientId: id });
  if (!p.ssnEncrypted) return res.json({ ssn: null });
  const ssn = decryptField(req.tenant!.key, p.ssnEncrypted);
  res.json({ ssn: `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5)}` });
});

// Notes: "EVERY ACTION IN ACCOUNT MUST BE NOTED BY EMPLOYEE" and "NOTES CANNOT BE LATER EDITED OR REMOVED".
patientsRouter.get("/api/patients/:id/notes", requirePermission("patient.view"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  res.json(await req.tenant!.db.select().from(notes).where(eq(notes.patientId, id)).orderBy(desc(notes.createdAt)));
});

patientsRouter.post("/api/patients/:id/notes", requirePermission("note.create"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  const input = noteInput.parse(req.body);
  if (!(await findItem("note_category", input.category))) throw new HttpError(400, "Unknown note category");
  const assignee = input.followUpDate ? await resolveAssignee(req, input.assignToUserId) : null;
  const db = req.tenant!.db;
  const n = await db.transaction(async (tx) => {
    const [n] = await tx
      .insert(notes)
      .values({ patientId: id, body: input.body, category: input.category, followUpDate: input.followUpDate ?? null, createdBy: req.user!.initials })
      .returning();
    // A follow-up date puts the account on the Call List.
    if (input.followUpDate && assignee) {
      await tx.insert(tasks).values({
        patientId: id,
        noteId: n.id,
        title: shortTitle(input.body),
        dueDate: input.followUpDate,
        assignedUserId: assignee.id,
        assignedInitials: assignee.initials,
        createdBy: req.user!.initials,
      });
    }
    return n;
  });
  await audit(req, { action: "create", entityType: "note", entityId: n.id, patientId: id, details: input.followUpDate ? "with follow-up" : undefined });
  publish(req.tenant!.clientId, { kind: "notes", patientId: id });
  if (input.followUpDate) publish(req.tenant!.clientId, { kind: "tasks", patientId: id });
  res.status(201).json(n);
});

/** Who a follow-up goes to: the chosen teammate (must work in this client), or the person writing the note. */
/** First line of a note, cut at a word (not mid-word) so it reads well on the Call List. */
function shortTitle(body: string, max = 120) {
  const line = body.split("\n")[0].trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export async function resolveAssignee(req: Request, userId?: number) {
  if (!userId || userId === req.user!.id) return { id: req.user!.id, initials: req.user!.initials };
  const [u] = await getControlDb().select().from(users).where(eq(users.id, userId));
  if (!u || !u.active || u.userType !== "staff" || !(await userCanAccessClient(u.id, req.tenant!.clientId))) {
    throw new HttpError(400, "That person doesn't work in this client");
  }
  return { id: u.id, initials: u.initials };
}

// Alerts: show when the account opens; entered by hand and removable.
patientsRouter.get("/api/patients/:id/alerts", requirePermission("patient.view"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  res.json(
    await req.tenant!.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.patientId, id), isNull(alerts.removedAt)))
      .orderBy(desc(alerts.createdAt)),
  );
});

patientsRouter.post("/api/patients/:id/alerts", requirePermission("alert.manage"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  const { body } = alertInput.parse(req.body);
  const [a] = await req.tenant!.db.insert(alerts).values({ patientId: id, body, createdBy: req.user!.initials }).returning();
  await audit(req, { action: "create", entityType: "alert", entityId: a.id, patientId: id });
  publish(req.tenant!.clientId, { kind: "alerts", patientId: id });
  res.status(201).json(a);
});

patientsRouter.delete("/api/patients/:id/alerts/:alertId", requirePermission("alert.manage"), async (req, res) => {
  const id = idParam(req);
  const alertId = idParam(req, "alertId");
  const result = await req.tenant!.db
    .update(alerts)
    .set({ removedAt: new Date(), removedBy: req.user!.initials })
    .where(and(eq(alerts.id, alertId), eq(alerts.patientId, id), isNull(alerts.removedAt)))
    .returning();
  if (!result.length) throw new HttpError(404, "Alert not found");
  await audit(req, { action: "remove", entityType: "alert", entityId: alertId, patientId: id });
  publish(req.tenant!.clientId, { kind: "alerts", patientId: id });
  res.json({ ok: true });
});
