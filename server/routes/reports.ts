// Reports from the REPORTS tab of the spec: Daily Activity, Aging, Monthly Historical Receivables,
// Employee Daily Productivity. All for the CURRENT client only. Every run and export is logged.
import { Router, type Request, type Response } from "express";
import { and, asc, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { ledgerEntries, notes, patients, patientInsurances, encounters, documents } from "@shared/schema/tenant";
import { isValidIsoDate, todayIso } from "@shared/dates";
import { formatCents } from "@shared/money";
import { audit, requireAuth, requireClient, requirePermission } from "../middleware";
import type { Tenant } from "../db/tenantDb";
import { AGING_BUCKETS, ageEntries } from "../lib/aging";

export const reportsRouter = Router();
reportsRouter.use("/api/reports", requireAuth, requireClient, requirePermission("report.view"));

const range = z.object({
  from: z.string().refine(isValidIsoDate).default(() => todayIso().slice(0, 8) + "01"),
  to: z.string().refine(isValidIsoDate).default(() => todayIso()),
  format: z.enum(["json", "csv"]).default("json"),
  asOf: z.string().refine(isValidIsoDate).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

function sendReport(req: Request, res: Response, name: string, columns: { key: string; label: string; money?: boolean }[], rows: Record<string, unknown>[], totals?: Record<string, unknown>) {
  const format = req.query.format === "csv" ? "csv" : "json";
  if (format === "csv") {
    const cell = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmt = (c: { key: string; money?: boolean }, r: Record<string, unknown>) => (c.money && typeof r[c.key] === "number" ? formatCents(r[c.key] as number).replace(/,/g, "") : r[c.key]);
    const lines = [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(fmt(c, r))).join(","))];
    if (totals) lines.push(columns.map((c) => cell(fmt(c, totals))).join(","));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${name}-${todayIso()}.csv"`);
    return res.send(lines.join("\n"));
  }
  res.json({ columns, rows, totals: totals ?? null });
}

async function logRun(req: Request, name: string) {
  await audit(req, { action: req.query.format === "csv" ? "export" : "view", entityType: `report.${name}` });
}

const KINDS = ["charge", "payment", "writeoff", "pat_share", "refund", "adjustment"] as const;

/** Daily Activity: totals per posting day, by type of entry. */
reportsRouter.get("/api/reports/daily-activity", async (req, res) => {
  const q = range.parse(req.query);
  const rows = await req.tenant!.db.select().from(ledgerEntries).where(and(gte(ledgerEntries.postDate, q.from), lte(ledgerEntries.postDate, q.to))).orderBy(asc(ledgerEntries.postDate));
  const byDay = new Map<string, Record<string, number | string>>();
  for (const e of rows) {
    const d = byDay.get(e.postDate) ?? { date: e.postDate, count: 0, ...Object.fromEntries(KINDS.map((k) => [k, 0])) };
    d[e.kind] = (d[e.kind] as number) + e.insuranceDeltaCents + e.patientDeltaCents;
    d.count = (d.count as number) + 1;
    byDay.set(e.postDate, d);
  }
  const out = [...byDay.values()];
  const totals: Record<string, number | string> = { date: "Total", count: out.reduce((s, r) => s + (r.count as number), 0) };
  for (const k of KINDS) totals[k] = out.reduce((s, r) => s + (r[k] as number), 0);
  await logRun(req, "daily-activity");
  sendReport(req, res, "daily-activity", [
    { key: "date", label: "Post date" }, { key: "count", label: "Entries" }, { key: "charge", label: "Charges", money: true }, { key: "payment", label: "Payments", money: true },
    { key: "writeoff", label: "Write-offs", money: true }, { key: "pat_share", label: "Patient share", money: true }, { key: "refund", label: "Refunds", money: true }, { key: "adjustment", label: "Adjustments", money: true },
  ], out, totals);
});

async function agingRows(t: Tenant, asOf: string) {
  const pts = await t.db.select().from(patients).where(isNull(patients.removedAt));
  const ins = await t.db.select().from(patientInsurances);
  const entries = await t.db.select().from(ledgerEntries).where(lte(ledgerEntries.postDate, asOf));
  const encDates = new Map((await t.db.select({ id: encounters.id, d: encounters.serviceDateFrom }).from(encounters)).map((e) => [e.id, e.d]));
  const rows = [];
  for (const p of pts) {
    const es = entries.filter((e) => e.patientId === p.id);
    const aged = ageEntries(es, encDates, asOf);
    const total = AGING_BUCKETS.reduce((s, b) => s + aged[b], 0);
    const r: Record<string, number | string> = { account: p.accountNumber, patient: `${p.lastName}, ${p.firstName}`, payer: ins.find((i) => i.patientId === p.id && i.rank === 1)?.payerName ?? "NONE", coverage: p.coverageType, ...aged, total };
    if (total !== 0) rows.push(r);
  }
  return rows.sort((a, b) => (b.total as number) - (a.total as number));
}

/** Aging: what's still owed, by how old the service is ("how outstanding AR is ran"). Optional group by payer. */
reportsRouter.get("/api/reports/aging", async (req, res) => {
  const q = range.parse(req.query);
  const asOf = q.asOf ?? todayIso();
  let rows = await agingRows(req.tenant!, asOf);
  const keys = ["0-30", "31-60", "61-90", "91-120", "121+", "total"];
  if (req.query.groupBy === "payer") {
    const g = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const x = g.get(r.payer as string) ?? { payer: r.payer, accounts: 0, ...Object.fromEntries(keys.map((k) => [k, 0])) };
      for (const k of keys) x[k] = (x[k] as number) + (r[k] as number);
      x.accounts = (x.accounts as number) + 1;
      g.set(r.payer as string, x);
    }
    rows = [...g.values()].sort((a, b) => (b.total as number) - (a.total as number));
  }
  const totals: Record<string, number | string> = { [req.query.groupBy === "payer" ? "payer" : "patient"]: "Total" };
  for (const k of keys) totals[k] = rows.reduce((s, r) => s + (r[k] as number), 0);
  await logRun(req, "aging");
  const lead = req.query.groupBy === "payer"
    ? [{ key: "payer", label: "Payer" }, { key: "accounts", label: "Accounts" }]
    : [{ key: "account", label: "Acct #" }, { key: "patient", label: "Patient" }, { key: "payer", label: "Primary payer" }];
  sendReport(req, res, "aging", [...lead, ...keys.map((k) => ({ key: k, label: k === "total" ? "Total" : `${k} days`, money: true }))], rows, totals);
});

/** Monthly Historical Receivables: per month, starting AR, activity, ending AR. */
reportsRouter.get("/api/reports/monthly-receivables", async (req, res) => {
  const q = range.parse(req.query);
  const year = q.year ?? Number(todayIso().slice(0, 4));
  const entries = await req.tenant!.db.select().from(ledgerEntries).where(lte(ledgerEntries.postDate, `${year}-12-31`));
  const rows = [];
  let running = entries.filter((e) => e.postDate < `${year}-01-01`).reduce((s, e) => s + e.insuranceDeltaCents + e.patientDeltaCents, 0);
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const es = entries.filter((e) => e.postDate.startsWith(`${year}-${mm}`));
    const sum = (k: string) => es.filter((e) => e.kind === k).reduce((s, e) => s + e.insuranceDeltaCents + e.patientDeltaCents, 0);
    const start = running;
    const net = es.reduce((s, e) => s + e.insuranceDeltaCents + e.patientDeltaCents, 0);
    running += net;
    rows.push({ month: `${year}-${mm}`, starting: start, charges: sum("charge"), payments: sum("payment"), writeoffs: sum("writeoff"), refunds: sum("refund"), adjustments: sum("adjustment"), ending: running });
  }
  await logRun(req, "monthly-receivables");
  sendReport(req, res, "monthly-receivables", [
    { key: "month", label: "Month" }, { key: "starting", label: "Starting AR", money: true }, { key: "charges", label: "Charges", money: true }, { key: "payments", label: "Payments", money: true },
    { key: "writeoffs", label: "Write-offs", money: true }, { key: "refunds", label: "Refunds", money: true }, { key: "adjustments", label: "Adjustments", money: true }, { key: "ending", label: "Ending AR", money: true },
  ], rows);
});

/** Employee Daily Productivity: how many of each thing each person entered. */
reportsRouter.get("/api/reports/productivity", async (req, res) => {
  const q = range.parse(req.query);
  const db = req.tenant!.db;
  const from = new Date(`${q.from}T00:00:00`), to = new Date(`${q.to}T23:59:59`);
  const [pts, encs, les, ns, ds] = await Promise.all([
    db.select({ by: patients.createdBy, at: patients.createdAt }).from(patients),
    db.select({ by: encounters.createdBy, at: encounters.createdAt }).from(encounters),
    db.select({ by: ledgerEntries.createdBy, at: ledgerEntries.createdAt, kind: ledgerEntries.kind, rev: ledgerEntries.reversesEntryId }).from(ledgerEntries),
    db.select({ by: notes.createdBy, at: notes.createdAt }).from(notes),
    db.select({ by: documents.verifiedBy, at: documents.verifiedAt }).from(documents),
  ]);
  const inRange = (d: Date | null) => !!d && d >= from && d <= to;
  const people = new Map<string, Record<string, number | string>>();
  const bump = (who: string | null, k: string) => {
    if (!who || who === "SYS") return;
    const r = people.get(who) ?? { user: who, patients: 0, claims: 0, payments: 0, writeoffs: 0, reversals: 0, notes: 0, documentsVerified: 0 };
    r[k] = (r[k] as number) + 1;
    people.set(who, r);
  };
  pts.filter((x) => inRange(x.at)).forEach((x) => bump(x.by, "patients"));
  encs.filter((x) => inRange(x.at)).forEach((x) => bump(x.by, "claims"));
  les.filter((x) => inRange(x.at)).forEach((x) => bump(x.by, x.rev ? "reversals" : x.kind === "payment" ? "payments" : x.kind === "writeoff" ? "writeoffs" : "_"));
  ns.filter((x) => inRange(x.at)).forEach((x) => bump(x.by, "notes"));
  ds.filter((x) => inRange(x.at)).forEach((x) => bump(x.by, "documentsVerified"));
  const rows = [...people.values()].map((r) => {
    const { _: _x, ...rest } = r as Record<string, number | string> & { _?: number };
    return rest;
  });
  await logRun(req, "productivity");
  sendReport(req, res, "productivity", [
    { key: "user", label: "User" }, { key: "patients", label: "Patients registered" }, { key: "claims", label: "Charges posted" }, { key: "payments", label: "Payments" },
    { key: "writeoffs", label: "Write-offs" }, { key: "reversals", label: "Reversals" }, { key: "notes", label: "Notes" }, { key: "documentsVerified", label: "Documents verified" },
  ], rows);
});

