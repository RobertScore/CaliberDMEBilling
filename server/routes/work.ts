// The patient overview (everything on one screen), the Call List (follow-ups) and live updates.
import { Router } from "express";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { alerts, documents, encounters, ledgerEntries, notes, patientInsurances, tasks } from "@shared/schema/tenant";
import { users, userClientAssignments } from "@shared/schema/control";
import { taskInput } from "@shared/validation";
import { docTypeLabel } from "@shared/documents";
import { todayIso } from "@shared/dates";
import { sumCents } from "@shared/money";
import { getControlDb } from "../db/control";
import { publish, subscribe } from "../lib/events";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { loadPatientOr404, patientView, resolveAssignee } from "./patients";
import { documentChecklist } from "./documents";

export const workRouter = Router();
workRouter.use(["/api/patients/:id/overview", "/api/tasks", "/api/events", "/api/team"], requireAuth, requireClient);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

/** Everything about one patient, for the default screen. */
workRouter.get("/api/patients/:id/overview", requirePermission("patient.view"), async (req, res) => {
  const id = idOf(req.params.id);
  await loadPatientOr404(req, id);
  const t = req.tenant!;
  const db = t.db;
  const patient = await patientView(req, id);
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.patientId, id)).orderBy(asc(ledgerEntries.id));
  const encs = await db.select().from(encounters).where(eq(encounters.patientId, id)).orderBy(desc(encounters.serviceDateFrom));
  const noteRows = await db.select().from(notes).where(eq(notes.patientId, id)).orderBy(desc(notes.createdAt)).limit(200);
  const alertRows = await db.select().from(alerts).where(and(eq(alerts.patientId, id), isNull(alerts.removedAt))).orderBy(desc(alerts.createdAt));
  const taskRows = await db.select().from(tasks).where(and(eq(tasks.patientId, id), eq(tasks.status, "open"))).orderBy(asc(tasks.dueDate));
  const docs = await db.select().from(documents).where(and(eq(documents.patientId, id), isNull(documents.removedAt))).orderBy(desc(documents.receivedAt));
  const ins = await db.select().from(patientInsurances).where(eq(patientInsurances.patientId, id));

  const today = todayIso();
  const aging: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "121+": 0 };
  for (const e of entries) {
    const days = Math.floor((Date.parse(today) - Date.parse(e.serviceDateFrom ?? e.postDate)) / 86400000);
    const k = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : days <= 120 ? "91-120" : "121+";
    aging[k] += e.insuranceDeltaCents + e.patientDeltaCents;
  }
  const claims = encs.map((e) => {
    const es = entries.filter((x) => x.encounterId === e.id);
    return {
      id: e.id,
      serviceDateFrom: e.serviceDateFrom,
      serviceDateTo: e.serviceDateTo,
      status: e.claimStatus,
      insuranceRank: e.insuranceRank,
      payerName: ins.find((i) => i.rank === e.insuranceRank)?.payerName ?? null,
      billedCents: sumCents(es.filter((x) => x.kind === "charge").map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
      paidCents: -sumCents(es.filter((x) => x.kind === "payment").map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
      balanceCents: sumCents(es.map((x) => x.insuranceDeltaCents + x.patientDeltaCents)),
      codes: es.filter((x) => x.kind === "charge" && x.code).map((x) => x.code!.split(" ")[0]),
    };
  });
  const lastPayment = [...entries].reverse().find((e) => e.kind === "payment" && !e.reversesEntryId) ?? null;

  // One history: notes, money, claims, documents. Newest first.
  const timeline = [
    ...noteRows.map((n) => ({ at: n.createdAt.toISOString(), type: "note" as const, category: n.category, text: n.body, by: n.createdBy, followUpDate: n.followUpDate })),
    ...entries.map((e) => ({ at: e.createdAt.toISOString(), type: "money" as const, kind: e.kind, text: e.description, amountCents: e.insuranceDeltaCents + e.patientDeltaCents, code: e.code, by: e.createdBy, reversal: !!e.reversesEntryId })),
    ...encs.map((e) => ({ at: e.createdAt.toISOString(), type: "claim" as const, text: `Charges posted for service ${e.serviceDateFrom}`, by: e.createdBy })),
    ...docs.map((d) => ({ at: d.receivedAt.toISOString(), type: "document" as const, text: `${docTypeLabel(d.docType)} received (${d.source})`, documentId: d.id, verified: !!d.verifiedAt, by: d.uploadedBy })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  await audit(req, { action: "view", entityType: "patient.overview", entityId: id, patientId: id });
  res.json({
    patient,
    balances: {
      insuranceCents: sumCents(entries.map((e) => e.insuranceDeltaCents)),
      patientCents: sumCents(entries.map((e) => e.patientDeltaCents)),
      totalCents: sumCents(entries.map((e) => e.insuranceDeltaCents + e.patientDeltaCents)),
    },
    aging,
    claims,
    lastPayment: lastPayment && { date: lastPayment.depositDate ?? lastPayment.postDate, amountCents: -(lastPayment.insuranceDeltaCents + lastPayment.patientDeltaCents), payerName: lastPayment.payerName, checkNumber: lastPayment.checkNumber },
    checklist: await documentChecklist(t, id),
    alerts: alertRows,
    tasks: taskRows,
    notes: noteRows,
    timeline: timeline.slice(0, 300),
  });
});

// ---- Call List / follow-ups ------------------------------------------------------------

workRouter.get("/api/tasks", requirePermission("task.manage"), async (req, res) => {
  const scope = req.query.scope === "all" ? "all" : "mine";
  const showDone = req.query.status === "done";
  const rows = await req.tenant!.db
    .select({
      id: tasks.id, patientId: tasks.patientId, title: tasks.title, dueDate: tasks.dueDate, status: tasks.status,
      assignedUserId: tasks.assignedUserId, assignedInitials: tasks.assignedInitials, createdBy: tasks.createdBy, createdAt: tasks.createdAt, doneAt: tasks.doneAt, doneBy: tasks.doneBy,
      patientName: sql<string | null>`(select p.last_name || ', ' || p.first_name from patients p where p.id = "tasks"."patient_id")`,
      accountNumber: sql<string | null>`(select p.account_number from patients p where p.id = "tasks"."patient_id")`,
      balanceCents: sql<number>`coalesce((select sum(insurance_delta_cents + patient_delta_cents) from ledger_entries le where le.patient_id = "tasks"."patient_id"), 0)::int`,
    })
    .from(tasks)
    .where(and(eq(tasks.status, showDone ? "done" : "open"), scope === "mine" ? eq(tasks.assignedUserId, req.user!.id) : undefined))
    .orderBy(showDone ? desc(tasks.doneAt) : asc(tasks.dueDate))
    .limit(500);
  const today = todayIso();
  res.json(rows.map((r) => ({ ...r, overdue: r.status === "open" && r.dueDate < today, dueToday: r.dueDate === today })));
});

workRouter.get("/api/tasks/summary", requirePermission("task.manage"), async (req, res) => {
  const today = todayIso();
  const [r] = await req.tenant!.db
    .select({ due: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.status, "open"), eq(tasks.assignedUserId, req.user!.id), lte(tasks.dueDate, today)));
  res.json({ dueNow: r.due });
});

workRouter.post("/api/tasks", requirePermission("task.manage"), async (req, res) => {
  const input = taskInput.parse(req.body);
  if (input.patientId) await loadPatientOr404(req, input.patientId);
  const who = await resolveAssignee(req, input.assignToUserId);
  const [row] = await req.tenant!.db
    .insert(tasks)
    .values({ patientId: input.patientId ?? null, title: input.title, dueDate: input.dueDate, assignedUserId: who.id, assignedInitials: who.initials, createdBy: req.user!.initials })
    .returning();
  await audit(req, { action: "create", entityType: "task", entityId: row.id, patientId: input.patientId });
  publish(req.tenant!.clientId, { kind: "tasks", patientId: input.patientId });
  res.status(201).json(row);
});

workRouter.post("/api/tasks/:taskId/done", requirePermission("task.manage"), async (req, res) => {
  const id = idOf(req.params.taskId);
  const [row] = await req.tenant!.db
    .update(tasks)
    .set({ status: "done", doneAt: new Date(), doneBy: req.user!.initials })
    .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
    .returning();
  if (!row) throw new HttpError(404, "Follow-up not found");
  await audit(req, { action: "update", entityType: "task", entityId: id, patientId: row.patientId ?? undefined, details: "done" });
  publish(req.tenant!.clientId, { kind: "tasks", patientId: row.patientId ?? undefined });
  res.json(row);
});

/** Teammates who work in this client (for assigning follow-ups). Names only, no PHI. */
workRouter.get("/api/team", requirePermission("task.manage"), async (req, res) => {
  const rows = await getControlDb()
    .select({ id: users.id, name: users.name, initials: users.initials })
    .from(users)
    .innerJoin(userClientAssignments, eq(userClientAssignments.userId, users.id))
    .where(and(eq(userClientAssignments.clientId, req.tenant!.clientId), eq(users.active, true), eq(users.userType, "staff")));
  res.json(rows);
});

/** Live updates for this client (Server-Sent Events). Carries IDs and kinds only. */
workRouter.get("/api/events", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(": connected\n\n");
  const unsubscribe = subscribe(req.tenant!.clientId, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(ping);
    unsubscribe();
  });
});

