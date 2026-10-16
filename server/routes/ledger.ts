// Charge entry, payment posting and the patient ledger. One client's database only (req.tenant).
import { Router, type Request } from "express";
import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";
import { auditLog, encounters, ledgerEntries, patientInsurances, patients, periodCloses, serviceLines } from "@shared/schema/tenant";
import { encounterInput, paymentInput, periodCloseInput, reverseInput } from "@shared/validation";
import { NO_PATIENT_BILLING_PAYER_TYPES, PAT_SHARE_TYPES, WRITEOFF_TYPES, type PayerType } from "@shared/picklists";
import { todayIso } from "@shared/dates";
import { sumCents } from "@shared/money";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { loadPatientOr404 } from "./patients";

export const ledgerRouter = Router();
ledgerRouter.use(["/api/patients", "/api/ledger", "/api/periods", "/api/audit", "/api/dashboard"], requireAuth, requireClient);

function idParam(req: Request, name = "id"): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
}

async function closedThrough(req: Request): Promise<string | null> {
  const [row] = await req.tenant!.db.select({ d: max(periodCloses.closedThrough) }).from(periodCloses);
  return row?.d ?? null;
}

async function assertOpenPeriod(req: Request, postDate: string) {
  const closed = await closedThrough(req);
  if (closed && postDate <= closed) throw new HttpError(409, `Books are closed through ${closed}. Post this in an open period.`);
}

/** The ledger screen: every entry plus balances computed from the entries themselves. */
ledgerRouter.get("/api/patients/:id/ledger", requirePermission("patient.view"), async (req, res) => {
  const id = idParam(req);
  const patient = await loadPatientOr404(req, id);
  const db = req.tenant!.db;
  const entries = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.patientId, id))
    .orderBy(asc(ledgerEntries.serviceDateFrom), asc(ledgerEntries.id));
  const encs = await db.select().from(encounters).where(eq(encounters.patientId, id)).orderBy(asc(encounters.serviceDateFrom));
  const lines = encs.length
    ? (await db.select().from(serviceLines)).filter((l) => encs.some((e) => e.id === l.encounterId))
    : [];
  const ins = await db.select().from(patientInsurances).where(eq(patientInsurances.patientId, id)).orderBy(asc(patientInsurances.rank));

  const insuranceBalanceCents = sumCents(entries.map((e) => e.insuranceDeltaCents));
  const patientBalanceCents = sumCents(entries.map((e) => e.patientDeltaCents));
  const reversed = new Set(entries.filter((e) => e.reversesEntryId).map((e) => e.reversesEntryId!));

  // Financial summary (old "Summary" button): aging of what's still owed, by date of service.
  const today = todayIso();
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "121+": 0 } as Record<string, number>;
  for (const e of entries) {
    const from = e.serviceDateFrom ?? e.postDate;
    const days = Math.floor((Date.parse(today) - Date.parse(from)) / 86400000);
    const key = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : days <= 120 ? "91-120" : "121+";
    buckets[key] += e.insuranceDeltaCents + e.patientDeltaCents;
  }
  const totalsByKind: Record<string, number> = {};
  for (const e of entries) totalsByKind[e.kind] = (totalsByKind[e.kind] ?? 0) + e.insuranceDeltaCents + e.patientDeltaCents;

  await audit(req, { action: "view", entityType: "ledger", entityId: id, patientId: id });
  res.json({
    patient: { id: patient.id, accountNumber: patient.accountNumber, lastName: patient.lastName, firstName: patient.firstName, dob: patient.dob, coverageType: patient.coverageType },
    insurances: ins.map((i) => ({ rank: i.rank, payerName: i.payerName, payerType: i.payerType, claimNumber: i.claimNumber, memberIdMasked: i.memberIdLast4 ? `****${i.memberIdLast4}` : null })),
    encounters: encs.map((e) => ({ ...e, lines: lines.filter((l) => l.encounterId === e.id).sort((a, b) => a.lineNumber - b.lineNumber) })),
    entries: entries.map((e) => ({ ...e, reversed: reversed.has(e.id) })),
    balances: { insuranceBalanceCents, patientBalanceCents, totalBalanceCents: insuranceBalanceCents + patientBalanceCents },
    summary: { aging: buckets, totalsByKind },
    closedThrough: await closedThrough(req),
  });
});

/** Charge entry (old "Service Lines Posting", Ctrl+K). Creates the claim data and one charge per line. */
ledgerRouter.post("/api/patients/:id/encounters", requirePermission("charge.post"), async (req, res) => {
  const id = idParam(req);
  await loadPatientOr404(req, id);
  const input = encounterInput.parse(req.body);
  const postDate = todayIso();
  await assertOpenPeriod(req, postDate);
  const [policy] = await req.tenant!.db
    .select()
    .from(patientInsurances)
    .where(and(eq(patientInsurances.patientId, id), eq(patientInsurances.rank, input.insuranceRank)));
  if (!policy) throw new HttpError(400, "That patient has no insurance at that rank. Add it in Patient Entry first.");

  const result = await req.tenant!.db.transaction(async (tx) => {
    const { lines, ...enc } = input;
    const [e] = await tx.insert(encounters).values({ ...enc, patientId: id, createdBy: req.user!.initials }).returning();
    const saved = [];
    for (const [i, l] of lines.entries()) {
      const chargeCents = l.unitPriceCents * l.quantity;
      const [sl] = await tx.insert(serviceLines).values({ ...l, encounterId: e.id, lineNumber: i + 1, chargeCents }).returning();
      await tx.insert(ledgerEntries).values({
        patientId: id,
        kind: "charge",
        postDate,
        serviceDateFrom: input.serviceDateFrom,
        serviceDateTo: input.serviceDateTo,
        serviceLineId: sl.id,
        encounterId: e.id,
        code: [l.hcpcsCode, ...l.modifiers].join(" "),
        description: l.description,
        quantity: l.quantity,
        insuranceDeltaCents: chargeCents,
        patientDeltaCents: 0,
        payerName: policy.payerName,
        createdBy: req.user!.initials,
      });
      saved.push(sl);
    }
    return { encounter: e, lines: saved };
  });
  await audit(req, { action: "post", entityType: "encounter", entityId: result.encounter.id, patientId: id, details: `${result.lines.length} lines` });
  res.status(201).json(result);
});

/** Payment posting (old "Payments & Writeoffs Posting", Ctrl+P): payment, write-off and patient share in one go. */
ledgerRouter.post("/api/patients/:id/payments", requirePermission("payment.post"), async (req, res) => {
  const id = idParam(req);
  const patient = await loadPatientOr404(req, id);
  const p = paymentInput.parse(req.body);
  const postDate = todayIso();
  await assertOpenPeriod(req, postDate);
  if (p.depositDate > postDate) throw new HttpError(400, "Deposit date can't be in the future");
  if (p.writeoffType && !WRITEOFF_TYPES.some((w) => w.code === p.writeoffType)) throw new HttpError(400, "Unknown write-off type");
  if (p.patShareType && !PAT_SHARE_TYPES.some((w) => w.code === p.patShareType)) throw new HttpError(400, "Unknown patient share type");
  if (p.encounterId) {
    const [e] = await req.tenant!.db.select().from(encounters).where(and(eq(encounters.id, p.encounterId), eq(encounters.patientId, id)));
    if (!e) throw new HttpError(404, "Claim data not found for this patient");
  }

  const warnings: string[] = [];
  // ASSUMPTION Q-012 / Q-046: Work Comp and VA patients generally can't be billed. We allow the entry but warn.
  if (p.patShareCents > 0 && NO_PATIENT_BILLING_PAYER_TYPES.includes(patient.coverageType as PayerType)) {
    warnings.push("This is a Work Comp / VA patient. Patients generally can't be billed for these claims (open question Q-046).");
  }

  const base = {
    patientId: id,
    postDate,
    depositDate: p.depositDate,
    serviceDateFrom: p.serviceDateFrom ?? null,
    serviceDateTo: p.serviceDateTo ?? null,
    encounterId: p.encounterId ?? null,
    payerName: p.payerName,
    paymentType: p.paymentType,
    checkNumber: p.checkNumber ?? null,
    claimControlNumber: p.claimControlNumber ?? null,
    batchNumber: p.batchNumber ?? null,
    createdBy: req.user!.initials,
  };
  const rows = [] as (typeof ledgerEntries.$inferInsert)[];
  if (p.paymentCents > 0) {
    rows.push({
      ...base,
      kind: "payment",
      description: `${p.payerIsPatient ? "PATIENT PAYMENT" : "PAYMENT"} ${p.paymentType}${p.checkNumber ? ` #${p.checkNumber}` : ""}`,
      insuranceDeltaCents: p.payerIsPatient ? 0 : -p.paymentCents,
      patientDeltaCents: p.payerIsPatient ? -p.paymentCents : 0,
    });
  }
  if (p.writeoffCents > 0) {
    const w = WRITEOFF_TYPES.find((x) => x.code === p.writeoffType)!;
    rows.push({ ...base, kind: "writeoff", reasonCode: w.code, description: w.label, insuranceDeltaCents: -p.writeoffCents, patientDeltaCents: 0 });
  }
  if (p.patShareCents > 0) {
    const s = PAT_SHARE_TYPES.find((x) => x.code === p.patShareType)!;
    // Moves the amount from what insurance owes to what the patient owes.
    rows.push({ ...base, kind: "pat_share", reasonCode: s.code, description: s.label, insuranceDeltaCents: -p.patShareCents, patientDeltaCents: p.patShareCents });
  }
  const inserted = await req.tenant!.db.insert(ledgerEntries).values(rows).returning();
  await audit(req, { action: "post", entityType: "payment", entityId: inserted.map((r) => r.id).join(","), patientId: id });
  res.status(201).json({ entries: inserted, warnings });
});

/** Fix a mistake: post an equal-and-opposite entry that points to the original. Nothing is erased. */
ledgerRouter.post("/api/ledger/:entryId/reverse", requirePermission("ledger.reverse"), async (req, res) => {
  const entryId = idParam(req, "entryId");
  const { reason } = reverseInput.parse(req.body);
  const db = req.tenant!.db;
  const [orig] = await db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId));
  if (!orig) throw new HttpError(404, "Entry not found");
  if (orig.reversesEntryId) throw new HttpError(400, "This entry is already a reversal");
  const [already] = await db.select().from(ledgerEntries).where(eq(ledgerEntries.reversesEntryId, entryId));
  if (already) throw new HttpError(400, "This entry was already reversed");
  const postDate = todayIso();
  await assertOpenPeriod(req, postDate);
  const { id: _id, createdAt: _c, ...rest } = orig;
  const [rev] = await db
    .insert(ledgerEntries)
    .values({
      ...rest,
      postDate,
      description: `REVERSAL: ${reason}`,
      insuranceDeltaCents: -orig.insuranceDeltaCents,
      patientDeltaCents: -orig.patientDeltaCents,
      reversesEntryId: orig.id,
      createdBy: req.user!.initials,
    })
    .returning();
  await audit(req, { action: "reverse", entityType: "ledger_entry", entityId: orig.id, patientId: orig.patientId });
  res.status(201).json(rev);
});

ledgerRouter.get("/api/periods", requirePermission("patient.view"), async (req, res) => {
  res.json(await req.tenant!.db.select().from(periodCloses).orderBy(desc(periodCloses.closedThrough)));
});

/** Close the books through a date. After this, nothing dated on or before it can be posted. */
ledgerRouter.post("/api/periods/close", requirePermission("period.close"), async (req, res) => {
  const { closedThrough: d } = periodCloseInput.parse(req.body);
  const current = await closedThrough(req);
  if (current && d <= current) throw new HttpError(400, `Books are already closed through ${current}`);
  if (d >= todayIso()) throw new HttpError(400, "You can only close a date in the past");
  const [row] = await req.tenant!.db.insert(periodCloses).values({ closedThrough: d, closedBy: req.user!.initials }).returning();
  await audit(req, { action: "close", entityType: "period", entityId: d });
  res.status(201).json(row);
});

ledgerRouter.get("/api/audit", requirePermission("audit.view"), async (req, res) => {
  res.json(await req.tenant!.db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(500));
});

/** Home screen numbers for the CURRENT client only: work waiting, money owed, recent accounts. */
ledgerRouter.get("/api/dashboard", requirePermission("patient.view"), async (req, res) => {
  const db = req.tenant!.db;
  const [{ patientCount }] = await db.select({ patientCount: sql<number>`count(*)::int` }).from(patients).where(isNull(patients.removedAt));
  const [{ notBilled }] = await db
    .select({ notBilled: sql<number>`count(*)::int` })
    .from(encounters)
    .innerJoin(patients, eq(patients.id, encounters.patientId))
    .where(and(eq(encounters.claimStatus, "not_billed"), isNull(patients.removedAt)));
  const [totals] = await db
    .select({
      insurance: sql<number>`coalesce(sum(${ledgerEntries.insuranceDeltaCents}), 0)::int`,
      patient: sql<number>`coalesce(sum(${ledgerEntries.patientDeltaCents}), 0)::int`,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(patients.id, ledgerEntries.patientId))
    .where(isNull(patients.removedAt));
  const [{ postedToday }] = await db
    .select({ postedToday: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.postDate, todayIso()));
  const recent = await db
    .select({
      id: patients.id,
      accountNumber: patients.accountNumber,
      lastName: patients.lastName,
      firstName: patients.firstName,
      coverageType: patients.coverageType,
      balanceCents: sql<number>`coalesce((select sum(insurance_delta_cents + patient_delta_cents) from ledger_entries le where le.patient_id = "patients"."id"), 0)::int`,
      lastActivity: sql<string>`greatest("patients"."created_at", coalesce((select max(le.created_at) from ledger_entries le where le.patient_id = "patients"."id"), "patients"."created_at"))`,
    })
    .from(patients)
    .where(isNull(patients.removedAt))
    .orderBy(desc(sql`7`))
    .limit(6);
  await audit(req, { action: "view", entityType: "dashboard", details: `${recent.length} recent accounts` });
  res.json({
    patientCount,
    claimsNotBilled: notBilled,
    insuranceOwedCents: totals.insurance,
    patientOwedCents: totals.patient,
    entriesPostedToday: postedToday,
    recent,
    closedThrough: await closedThrough(req),
  });
});
