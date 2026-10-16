// Code sets and the payer directory (control database, no PHI).
import { Router } from "express";
import { asc, eq, ilike, or } from "drizzle-orm";
import { getControlDb } from "../db/control";
import { hcpcsCodes, icd10Codes, modifiers, payers } from "@shared/schema/control";
import { requireAuth, requirePermission } from "../middleware";

export const codesRouter = Router();
codesRouter.use("/api/codes", requireAuth, requirePermission("codes.view"));
codesRouter.use("/api/payers", requireAuth);

function q(req: { query: Record<string, unknown> }) {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  return raw.slice(0, 40).replace(/[%_]/g, "");
}

codesRouter.get("/api/codes/hcpcs", async (req, res) => {
  const s = q(req);
  const rows = await getControlDb()
    .select()
    .from(hcpcsCodes)
    .where(s ? or(ilike(hcpcsCodes.code, `${s}%`), ilike(hcpcsCodes.shortDescription, `%${s}%`)) : undefined)
    .orderBy(asc(hcpcsCodes.code))
    .limit(50);
  res.json(rows);
});

codesRouter.get("/api/codes/icd10", async (req, res) => {
  const s = q(req);
  const rows = await getControlDb()
    .select()
    .from(icd10Codes)
    .where(s ? or(ilike(icd10Codes.code, `${s}%`), ilike(icd10Codes.description, `%${s}%`)) : undefined)
    .orderBy(asc(icd10Codes.code))
    .limit(50);
  res.json(rows);
});

codesRouter.get("/api/codes/modifiers", async (_req, res) => {
  res.json(await getControlDb().select().from(modifiers).orderBy(asc(modifiers.code)));
});

codesRouter.get("/api/payers", async (_req, res) => {
  res.json(await getControlDb().select().from(payers).where(eq(payers.active, true)).orderBy(asc(payers.name)));
});
