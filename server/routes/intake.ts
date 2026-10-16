// The intake inbox: paperwork in → read → review → match → file to a new or existing patient.
import { Router, type Request } from "express";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { documents, intakeItems, notes, patients } from "@shared/schema/tenant";
import { DOC_TYPES, INTAKE_SOURCES, docTypeLabel, type Extraction } from "@shared/documents";
import { patientInput, type PatientInput } from "@shared/validation";
import { getFile } from "../lib/fileStore";
import { readPaperwork } from "../lib/reader";
import { findMatches, type MatchInput } from "../lib/match";
import { demoPacket } from "../lib/demoPaperwork";
import { publish } from "../lib/events";
import { last4 } from "../lib/crypto";
import { IS_PRODUCTION } from "../config";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { storeFiles, upload } from "./documents";
import { createPatientRecord, loadPatientOr404, patientView, updatePatientRecord } from "./patients";
import type { Tenant } from "../db/tenantDb";

export const intakeRouter = Router();
intakeRouter.use("/api/intake", requireAuth, requireClient);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

/** Create an inbox item from files. Used by staff uploads, both portals and the inbound API. */
export async function createIntake(
  req: Request,
  files: Express.Multer.File[],
  meta: { source: string; sender?: string | null; subject?: string | null; suggestedPatientId?: number | null; createdBy: string },
) {
  const t = req.tenant!;
  const [item] = await t.db
    .insert(intakeItems)
    .values({ source: meta.source, sender: meta.sender ?? null, subject: meta.subject ?? null, suggestedPatientId: meta.suggestedPatientId ?? null, status: "reading", createdBy: meta.createdBy })
    .returning();
  await storeFiles(req, files, { intakeId: item.id, source: meta.source, uploadedBy: meta.createdBy });
  publish(t.clientId, { kind: "intake" });
  // Reading can take a little while with the AI reader; it runs in the background and the inbox updates live.
  void runReader(t, item.id);
  return item;
}

export async function runReader(t: Tenant, intakeId: number) {
  try {
    const docs = await t.db.select().from(documents).where(eq(documents.intakeId, intakeId));
    const files = docs.map((d) => ({ data: getFile(t, d.storageKey), mimeType: d.mimeType, sha256: d.sha256, name: d.originalName }));
    const result = await readPaperwork(files);
    // Apply the reader's suggested document types (still unverified until a person checks).
    for (const g of result.extraction?.documents ?? []) {
      const d = docs[g.index];
      if (d && DOC_TYPES.some((x) => x.code === g.docType)) await t.db.update(documents).set({ docType: g.docType }).where(eq(documents.id, d.id));
    }
    await t.db.update(intakeItems).set({ status: "review", reader: result.reader, extraction: result.extraction, readerError: result.error ?? null }).where(eq(intakeItems.id, intakeId));
  } catch {
    await t.db.update(intakeItems).set({ status: "review", reader: "manual", readerError: "The reader failed. Please enter the fields by hand." }).where(eq(intakeItems.id, intakeId));
  }
  publish(t.clientId, { kind: "intake" });
}

function matchInputFrom(e: Extraction | null): MatchInput {
  if (!e) return {};
  const p = e.patient;
  return {
    lastName: p.lastName.value,
    firstName: p.firstName.value,
    dob: p.dob.value,
    ssnLast4: p.ssn.value ? last4(p.ssn.value) : null,
    phone: p.phone.value ?? p.cellPhone.value,
    claimNumber: e.insurances.find((i) => i.claimNumber.value)?.claimNumber.value ?? null,
    memberIdLast4: e.insurances.find((i) => i.memberId.value)?.memberId.value ? last4(e.insurances.find((i) => i.memberId.value)!.memberId.value!) : null,
  };
}

const publicDoc = (d: typeof documents.$inferSelect) => {
  const { storageKey: _k, ...rest } = d;
  return { ...rest, typeLabel: docTypeLabel(d.docType) };
};

intakeRouter.get("/api/intake", requirePermission("intake.process"), async (req, res) => {
  const done = req.query.status === "done";
  const rows = await req.tenant!.db
    .select({
      id: intakeItems.id, source: intakeItems.source, sender: intakeItems.sender, subject: intakeItems.subject, receivedAt: intakeItems.receivedAt,
      status: intakeItems.status, reader: intakeItems.reader, decision: intakeItems.decision, patientId: intakeItems.patientId, completedAt: intakeItems.completedAt, completedBy: intakeItems.completedBy,
      docCount: sql<number>`(select count(*)::int from documents d where d.intake_id = "intake_items"."id")`,
      patientName: sql<string | null>`(select p.last_name || ', ' || p.first_name from patients p where p.id = coalesce("intake_items"."patient_id", "intake_items"."suggested_patient_id"))`,
      extraction: intakeItems.extraction,
    })
    .from(intakeItems)
    .where(done ? inArray(intakeItems.status, ["done", "rejected"]) : inArray(intakeItems.status, ["reading", "review", "new"]))
    .orderBy(desc(intakeItems.receivedAt))
    .limit(200);
  // Show the name the reader found, so the inbox is easy to scan.
  res.json(rows.map(({ extraction, ...r }) => {
    const e = extraction as Extraction | null;
    const found = e ? [e.patient.lastName.value, e.patient.firstName.value].filter(Boolean).join(", ") : null;
    return { ...r, foundName: r.patientName ?? (found || null) };
  }));
});

intakeRouter.get("/api/intake/count", requirePermission("intake.process"), async (req, res) => {
  const [{ n }] = await req.tenant!.db.select({ n: sql<number>`count(*)::int` }).from(intakeItems).where(inArray(intakeItems.status, ["reading", "review", "new"]));
  res.json({ open: n });
});

/** Staff upload (or scan) of new paperwork. */
intakeRouter.post("/api/intake", requirePermission("intake.process"), upload.array("files", 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "Choose a PDF or image to upload (PDF, PNG, JPG, TIFF, HEIC, WEBP up to 25 MB).");
  const source = (INTAKE_SOURCES as readonly string[]).includes(req.body.source) ? req.body.source : "upload";
  const item = await createIntake(req, files, { source, sender: String(req.body.sender ?? "").slice(0, 120) || null, subject: String(req.body.subject ?? "").slice(0, 200) || null, createdBy: req.user!.initials });
  await audit(req, { action: "create", entityType: "intake", entityId: item.id, details: `${files.length} files via ${source}` });
  res.status(201).json(item);
});

/** Local demo only: pretend a fax or email just arrived, using fake sample paperwork. */
intakeRouter.post("/api/intake/demo", requirePermission("intake.process"), async (req, res) => {
  if (IS_PRODUCTION) throw new HttpError(404, "Not found");
  const kind = req.body?.kind === "existing" ? "existing" : "new";
  const [first] = await req.tenant!.db.select().from(patients).where(sql`${patients.lastName} like 'TEST-%'`).limit(1);
  const packet = demoPacket(kind, first?.lastName ?? "TEST-SCORE");
  const file = { buffer: packet.pdf, originalname: packet.name, mimetype: "application/pdf", size: packet.pdf.length } as Express.Multer.File;
  const item = await createIntake(req, [file], {
    source: kind === "new" ? "fax" : "email",
    sender: kind === "new" ? "Fax (555) 010-0100 · Sample Orthopedic Clinic" : "deliveries@sample-dme.test",
    subject: kind === "new" ? "New DME order" : "Signed delivery ticket",
    createdBy: "SYS",
  });
  res.status(201).json(item);
});

intakeRouter.get("/api/intake/:id", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const [item] = await req.tenant!.db.select().from(intakeItems).where(eq(intakeItems.id, id));
  if (!item) throw new HttpError(404, "Not found");
  const docs = await req.tenant!.db.select().from(documents).where(eq(documents.intakeId, id));
  const matches = item.status === "review" ? await findMatches(req.tenant!, matchInputFrom(item.extraction as Extraction | null)) : [];
  if (item.suggestedPatientId && !matches.some((m) => m.patientId === item.suggestedPatientId)) {
    const [p] = await req.tenant!.db.select().from(patients).where(eq(patients.id, item.suggestedPatientId));
    if (p) matches.unshift({ patientId: p.id, accountNumber: p.accountNumber, lastName: p.lastName, firstName: p.firstName, dob: p.dob, score: 100, reasons: ["Uploaded through this patient's portal"] });
  }
  await audit(req, { action: "view", entityType: "intake", entityId: id });
  res.json({ ...item, documents: docs.map(publicDoc), matches });
});

/** Re-check for matches using the fields as the reviewer has corrected them. */
intakeRouter.post("/api/intake/:id/matches", requirePermission("intake.process"), async (req, res) => {
  idOf(req.params.id);
  const b = z.object({ lastName: z.string().optional(), firstName: z.string().optional(), dob: z.string().optional(), ssn: z.string().optional(), phone: z.string().optional(), claimNumber: z.string().optional() }).parse(req.body);
  res.json(await findMatches(req.tenant!, { ...b, ssnLast4: b.ssn ? last4(b.ssn) : null }));
});

intakeRouter.post("/api/intake/:id/reread", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  await req.tenant!.db.update(intakeItems).set({ status: "reading" }).where(and(eq(intakeItems.id, id), ne(intakeItems.status, "done")));
  publish(req.tenant!.clientId, { kind: "intake" });
  void runReader(req.tenant!, id);
  res.json({ ok: true });
});

const completeInput = z
  .object({
    decision: z.enum(["new", "existing"]),
    patientId: z.number().int().positive().optional(),
    patient: patientInput.optional(),
    applyUpdates: z.boolean().default(false),
    confirmNotDuplicate: z.boolean().default(false),
    documents: z.array(z.object({ id: z.number().int().positive(), docType: z.enum(DOC_TYPES.map((d) => d.code) as [string, ...string[]]), verified: z.boolean() }).strict()).min(1),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

/** Merge reviewed values over what's on file (only non-empty values replace; insurance by rank). */
async function mergeIntoExisting(req: Request, id: number, reviewed: PatientInput): Promise<PatientInput> {
  const cur = await patientView(req, id);
  const keys = Object.keys(patientInput.shape) as (keyof PatientInput)[];
  const base: Record<string, unknown> = {};
  for (const k of keys) if (k !== "insurances" && k !== "ssn" && (cur as Record<string, unknown>)[k] != null) base[k] = (cur as Record<string, unknown>)[k];
  for (const [k, v] of Object.entries(reviewed)) if (k !== "insurances" && v !== undefined && v !== null && v !== "") base[k] = v;
  const insKeys = ["rank", "payerId", "claimNumber", "copayCents", "deductibleCents", "eligibleFrom", "eligibleTo", "relationshipToInsured", "subscriberLastName", "subscriberFirstName", "subscriberDob", "subscriberSex", "groupNumber", "groupName", "dateOfInjury", "employerName", "adjusterName", "adjusterPhone", "referralNumber", "authorizationNumber"];
  const byRank = new Map<number, Record<string, unknown>>();
  for (const i of cur.insurances) byRank.set(i.rank, Object.fromEntries(insKeys.filter((k) => (i as Record<string, unknown>)[k] != null).map((k) => [k, (i as Record<string, unknown>)[k]])));
  for (const i of reviewed.insurances) byRank.set(i.rank, { ...(byRank.get(i.rank) ?? {}), ...Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined && v !== "")) });
  return patientInput.parse({ ...base, insurances: [...byRank.values()] });
}

intakeRouter.post("/api/intake/:id/complete", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const t = req.tenant!;
  const [item] = await t.db.select().from(intakeItems).where(eq(intakeItems.id, id));
  if (!item || item.status === "done" || item.status === "rejected") throw new HttpError(409, "This paperwork was already handled");
  const input = completeInput.parse(req.body);
  const docs = await t.db.select().from(documents).where(eq(documents.intakeId, id));
  const docIds = new Set(docs.map((d) => d.id));
  if (input.documents.some((d) => !docIds.has(d.id))) throw new HttpError(400, "Those documents aren't part of this paperwork");

  let patientId: number;
  if (input.decision === "new") {
    if (!input.patient) throw new HttpError(400, "Fill in the patient's details to create a new patient");
    // Don't create a duplicate by accident: a strong match must be explicitly dismissed.
    const strong = (await findMatches(t, { lastName: input.patient.lastName, firstName: input.patient.firstName, dob: input.patient.dob, ssnLast4: input.patient.ssn ? last4(input.patient.ssn) : null, phone: input.patient.phone, claimNumber: input.patient.insurances.find((i) => i.claimNumber)?.claimNumber })).filter((m) => m.score >= 80);
    if (strong.length && !input.confirmNotDuplicate) {
      throw new HttpError(409, `This looks like an existing patient (${strong[0].lastName}, ${strong[0].firstName}, #${strong[0].accountNumber}). Attach it to them, or confirm it's a different person.`);
    }
    patientId = (await createPatientRecord(req, input.patient)).id;
  } else {
    if (!input.patientId) throw new HttpError(400, "Pick the existing patient");
    await loadPatientOr404(req, input.patientId);
    patientId = input.patientId;
    if (input.applyUpdates && input.patient) await updatePatientRecord(req, patientId, await mergeIntoExisting(req, patientId, input.patient), "updated from intake");
  }

  for (const d of input.documents) {
    await t.db
      .update(documents)
      .set({ patientId, docType: d.docType, ...(d.verified ? { verifiedAt: new Date(), verifiedBy: req.user!.initials } : {}) })
      .where(eq(documents.id, d.id));
  }
  const summary = `Paperwork received by ${item.source}${item.sender ? ` from ${item.sender}` : ""}: ${input.documents.map((d) => docTypeLabel(d.docType)).join(", ")}. Filed to ${input.decision === "new" ? "a new patient" : "existing patient"}.${input.note ? `\n${input.note}` : ""}`;
  await t.db.insert(notes).values({ patientId, body: summary, category: "intake", createdBy: req.user!.initials });
  await t.db.update(intakeItems).set({ status: "done", decision: input.decision, patientId, completedAt: new Date(), completedBy: req.user!.initials }).where(eq(intakeItems.id, id));
  await audit(req, { action: "post", entityType: "intake", entityId: id, patientId, details: `${input.decision}; ${input.documents.length} documents` });
  publish(t.clientId, { kind: "intake" });
  publish(t.clientId, { kind: "documents", patientId });
  publish(t.clientId, { kind: "notes", patientId });
  res.json({ patientId });
});

intakeRouter.post("/api/intake/:id/reject", requirePermission("intake.process"), async (req, res) => {
  const id = idOf(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).strict().parse(req.body);
  const r = await req.tenant!.db
    .update(intakeItems)
    .set({ status: "rejected", completedAt: new Date(), completedBy: req.user!.initials, readerError: `Not filed: ${reason}` })
    .where(and(eq(intakeItems.id, id), inArray(intakeItems.status, ["review", "reading", "new"])))
    .returning();
  if (!r.length) throw new HttpError(409, "This paperwork was already handled");
  await audit(req, { action: "remove", entityType: "intake", entityId: id, details: "not filed" });
  publish(req.tenant!.clientId, { kind: "intake" });
  res.json({ ok: true });
});

