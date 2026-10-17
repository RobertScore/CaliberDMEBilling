// Code sets and the payer directory (control database, no PHI).
import { Router } from "express";
import { and, asc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { isValidIsoDate, todayIso } from "@shared/dates";
import { getControlDb } from "../db/control";
import { hcpcsCodes, icd10Codes, modifiers, payers } from "@shared/schema/control";
import { requireAuth, requirePermission } from "../middleware";

export const codesRouter = Router();
codesRouter.use("/api/codes", requireAuth, requirePermission("codes.view"));
codesRouter.use("/api/payers", requireAuth);

function q(req: { query: Record<string, unknown> }) {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  return raw.slice(0, 60).replace(/[%_\\]/g, "");
}

/** The date codes must be valid on: ?on=YYYY-MM-DD (date of service), default today. ?all=1 includes retired codes. */
function onDate(req: { query: Record<string, unknown> }) {
  const on = typeof req.query.on === "string" && isValidIsoDate(req.query.on) ? req.query.on : todayIso();
  return { on, all: req.query.all === "1" };
}

/** Every word must match the code (start) or a description (anywhere); exact and code matches sort first. */
export function codeSearch(cols: { code: AnyPgColumn; texts: AnyPgColumn[]; from: AnyPgColumn; to: AnyPgColumn }, text: string, on: string, all: boolean) {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 6);
  const where = and(
    ...words.map((w) => or(ilike(cols.code, `${w}%`), ...cols.texts.map((t) => ilike(t, `%${w}%`)))),
    all ? undefined : and(or(isNull(cols.from), lte(cols.from, on)), or(isNull(cols.to), gte(cols.to, on))),
  );
  const order = sql`case when ${cols.code} = ${text.toUpperCase()} then 0 when ${cols.code} ilike ${`${words[0] ?? ""}%`} then 1 else 2 end`;
  return { where, order };
}

codesRouter.get("/api/codes/hcpcs", async (req, res) => {
  const { on, all } = onDate(req);
  const s = codeSearch({ code: hcpcsCodes.code, texts: [hcpcsCodes.shortDescription, hcpcsCodes.longDescription], from: hcpcsCodes.effectiveFrom, to: hcpcsCodes.effectiveTo }, q(req), on, all);
  res.json(await getControlDb().select().from(hcpcsCodes).where(s.where).orderBy(s.order, asc(hcpcsCodes.code)).limit(50));
});

codesRouter.get("/api/codes/icd10", async (req, res) => {
  const { on, all } = onDate(req);
  const s = codeSearch({ code: icd10Codes.code, texts: [icd10Codes.description, icd10Codes.shortDescription], from: icd10Codes.effectiveFrom, to: icd10Codes.effectiveTo }, q(req), on, all);
  res.json(await getControlDb().select().from(icd10Codes).where(s.where).orderBy(s.order, asc(icd10Codes.code)).limit(50));
});

codesRouter.get("/api/codes/modifiers", async (req, res) => {
  const { on, all } = onDate(req);
  const rows = await getControlDb().select().from(modifiers).orderBy(asc(modifiers.code));
  res.json(all ? rows : rows.filter((r) => (!r.effectiveFrom || r.effectiveFrom <= on) && (!r.effectiveTo || r.effectiveTo >= on)));
});

codesRouter.get("/api/payers", async (_req, res) => {
  res.json(await getControlDb().select().from(payers).where(eq(payers.active, true)).orderBy(asc(payers.name)));
});
