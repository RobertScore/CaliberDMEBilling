// Patient documents: upload, view, set type, verify, and the "what do we have / what's missing" checklist.
import { Router, type Request } from "express";
import multer from "multer";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { documents, patientInsurances, patients } from "@shared/schema/tenant";
import { documentRequirements } from "@shared/schema/control";
import { ALLOWED_UPLOAD_TYPES, DOC_TYPES, MAX_UPLOAD_BYTES, docTypeLabel } from "@shared/documents";
import { getControlDb } from "../db/control";
import { getFile, putFile, sha256 } from "../lib/fileStore";
import { publish } from "../lib/events";
import { HttpError, audit, requireAuth, requireClient, requirePermission } from "../middleware";
import { loadPatientOr404 } from "./patients";
import type { Tenant } from "../db/tenantDb";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 },
  fileFilter: (_req, file, cb) => cb(null, (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)),
});

export const documentsRouter = Router();
documentsRouter.use(["/api/patients/:id/documents", "/api/documents"], requireAuth, requireClient);

const idOf = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
};

/** Save uploaded files into this client's encrypted storage. */
export async function storeFiles(
  req: Request,
  files: Express.Multer.File[],
  meta: { patientId?: number | null; intakeId?: number | null; source: string; docType?: string; uploadedBy?: string },
) {
  const t = req.tenant!;
  const rows = [];
  for (const f of files) {
    const storageKey = putFile(t, f.buffer);
    const [d] = await t.db
      .insert(documents)
      .values({
        patientId: meta.patientId ?? null,
        intakeId: meta.intakeId ?? null,
        docType: meta.docType ?? "other",
        originalName: f.originalname.slice(0, 200),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        sha256: sha256(f.buffer),
        storageKey,
        source: meta.source,
        uploadedBy: meta.uploadedBy ?? req.user!.initials,
      })
      .returning();
    rows.push(d);
  }
  return rows;
}

/** Which documents this patient needs (from Settings → Document requirements) and which ones we have. */
export async function documentChecklist(t: Tenant, patientId: number) {
  const [p] = await t.db.select().from(patients).where(eq(patients.id, patientId));
  const ins = await t.db.select().from(patientInsurances).where(eq(patientInsurances.patientId, patientId));
  const payerTypes = [...new Set([p?.coverageType, ...ins.map((i) => i.payerType)].filter(Boolean) as string[])];
  const reqs = payerTypes.length
    ? await getControlDb().select().from(documentRequirements).where(and(inArray(documentRequirements.payerType, payerTypes), eq(documentRequirements.required, true)))
    : [];
  const docs = await t.db.select().from(documents).where(and(eq(documents.patientId, patientId), isNull(documents.removedAt)));
  const types = [...new Set(reqs.map((r) => r.docType))];
  const items = types.map((docType) => {
    const matching = docs.filter((d) => d.docType === docType);
    const verified = matching.find((d) => d.verifiedAt);
    const status = verified ? "verified" : matching.length ? "received" : "missing";
    return {
      docType,
      label: docTypeLabel(docType),
      status,
      documentId: (verified ?? matching[0])?.id ?? null,
      neededFor: reqs.filter((r) => r.docType === docType).map((r) => r.payerType),
    };
  });
  return {
    items,
    complete: items.length > 0 && items.every((i) => i.status === "verified"),
    missingCount: items.filter((i) => i.status === "missing").length,
    unverifiedCount: items.filter((i) => i.status === "received").length,
  };
}

const publicDoc = (d: typeof documents.$inferSelect) => {
  const { storageKey: _k, ...rest } = d;
  return { ...rest, typeLabel: docTypeLabel(d.docType) };
};

documentsRouter.get("/api/patients/:id/documents", requirePermission("document.view"), async (req, res) => {
  const id = idOf(req.params.id);
  await loadPatientOr404(req, id);
  const rows = await req.tenant!.db.select().from(documents).where(and(eq(documents.patientId, id), isNull(documents.removedAt))).orderBy(desc(documents.receivedAt));
  res.json({ documents: rows.map(publicDoc), checklist: await documentChecklist(req.tenant!, id) });
});

documentsRouter.post("/api/patients/:id/documents", requirePermission("document.upload"), upload.array("files", 20), async (req, res) => {
  const id = idOf(req.params.id);
  await loadPatientOr404(req, id);
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, "Choose a PDF or image to upload (PDF, PNG, JPG, TIFF, HEIC, WEBP up to 25 MB).");
  const docType = DOC_TYPES.some((d) => d.code === req.body.docType) ? req.body.docType : "other";
  const rows = await storeFiles(req, files, { patientId: id, source: "upload", docType });
  await audit(req, { action: "create", entityType: "document", entityId: rows.map((r) => r.id).join(","), patientId: id });
  publish(req.tenant!.clientId, { kind: "documents", patientId: id });
  res.status(201).json(rows.map(publicDoc));
});

async function loadDoc(req: Request) {
  const id = idOf(req.params.docId);
  const [d] = await req.tenant!.db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.removedAt)));
  if (!d) throw new HttpError(404, "Document not found");
  return d;
}

/** The file itself, decrypted for viewing. Every view is logged. */
documentsRouter.get("/api/documents/:docId/file", requirePermission("document.view"), async (req, res) => {
  const d = await loadDoc(req);
  const data = getFile(req.tenant!, d.storageKey);
  await audit(req, { action: "view", entityType: "document", entityId: d.id, patientId: d.patientId ?? undefined });
  res.setHeader("Content-Type", d.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="document-${d.id}"`);
  res.setHeader("Content-Security-Policy", "sandbox");
  res.send(data);
});

const docUpdate = z
  .object({ docType: z.enum(DOC_TYPES.map((d) => d.code) as [string, ...string[]]).optional(), title: z.string().trim().max(120).optional(), verified: z.boolean().optional() })
  .strict();

/** Set the type and mark a document verified ("a person checked: right type, complete and readable"). */
documentsRouter.patch("/api/documents/:docId", requirePermission("document.verify"), async (req, res) => {
  const d = await loadDoc(req);
  const input = docUpdate.parse(req.body);
  const typeChanged = input.docType && input.docType !== d.docType;
  const [row] = await req.tenant!.db
    .update(documents)
    .set({
      ...(input.docType ? { docType: input.docType } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.verified === true ? { verifiedAt: new Date(), verifiedBy: req.user!.initials } : {}),
      // Changing the type or un-verifying means it needs checking again.
      ...(input.verified === false || (typeChanged && input.verified !== true) ? { verifiedAt: null, verifiedBy: null } : {}),
    })
    .where(eq(documents.id, d.id))
    .returning();
  await audit(req, { action: "update", entityType: "document", entityId: d.id, patientId: d.patientId ?? undefined, details: Object.keys(input).join(",") });
  if (d.patientId) publish(req.tenant!.clientId, { kind: "documents", patientId: d.patientId });
  res.json(publicDoc(row));
});

/** Management only. Hidden from lists but kept (documentation must be kept). */
documentsRouter.delete("/api/documents/:docId", requirePermission("patient.remove"), async (req, res) => {
  const d = await loadDoc(req);
  await req.tenant!.db.update(documents).set({ removedAt: new Date(), removedBy: req.user!.initials }).where(eq(documents.id, d.id));
  await audit(req, { action: "remove", entityType: "document", entityId: d.id, patientId: d.patientId ?? undefined });
  if (d.patientId) publish(req.tenant!.clientId, { kind: "documents", patientId: d.patientId });
  res.json({ ok: true });
});

export const DEFAULT_REQUIREMENTS: { payerType: string; docType: string; note?: string }[] = [
  ...["rx", "delivery_ticket", "po", "rfa", "authorization", "chart_notes", "demographics"].map((docType) => ({ payerType: "WC", docType })),
  ...["rx", "delivery_ticket", "referral", "authorization", "chart_notes", "demographics"].map((docType) => ({ payerType: "VA_CCN", docType })),
  ...["rx", "delivery_ticket", "po", "authorization", "chart_notes", "demographics"].map((docType) => ({ payerType: "VA_DIRECT", docType })),
  ...["rx", "delivery_ticket", "chart_notes", "demographics", "insurance_card"].map((docType) => ({ payerType: "COMMERCIAL", docType })),
];

export async function listRequirements() {
  return getControlDb().select().from(documentRequirements).orderBy(asc(documentRequirements.payerType), asc(documentRequirements.docType));
}
