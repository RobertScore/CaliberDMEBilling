// Official code sets: HCPCS Level II (+ modifiers) from CMS, ICD-10-CM from CDC/NCHS.
//
// The files are read exactly as their published record layouts describe:
//  - HCPCS "Alpha-Numeric HCPCS File" (HCPC<year>_<qtr>_ANWEB*.txt, 320-character records, see HCPC<year>_recordlayout.txt)
//  - ICD-10-CM order file (icd10cm-order-<year>.txt, see icd10OrderFiles.pdf in the same zip)
// Nothing is typed in by hand. Every load is recorded in code_set_loads with the source URL and the file's SHA-256.
//
// Versioning (CLAUDE.md 6): codes are never deleted. ICD-10-CM is versioned by fiscal year: a code that changes or
// disappears gets an end date and, if changed, a new row from the new year's start date. HCPCS rows carry the
// added and termination dates CMS publishes for each code.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { codeSetLoads, hcpcsCodes, icd10Codes, modifiers } from "@shared/schema/control";
import { getControlDb } from "../db/control";

export type CodeSet = "hcpcs" | "icd10cm";
export type OfficialFile = { codeSet: CodeSet; version: string; effectiveFrom: string; sourceUrl: string; file: string; sha256: string };

const BATCH = 1000;
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

/** CMS dates are YYYYMMDD. */
const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ---- Parsers ---------------------------------------------------------------------------------

export type HcpcsRow = { code: string; shortDescription: string; longDescription: string; addedDate: string | null; effectiveDate: string | null; terminationDate: string | null; actionCode: string };

/** HCPCS fixed-width file. Record id (pos 11): 3/4 = procedure first/continuation line, 7/8 = modifier first/continuation. */
export function parseHcpcs(text: string): { codes: HcpcsRow[]; modifiers: HcpcsRow[] } {
  const codes = new Map<string, HcpcsRow>();
  const mods = new Map<string, HcpcsRow>();
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 12) continue;
    const rec = line[10];
    const isMod = rec === "7" || rec === "8";
    const code = (isMod ? line.slice(3, 5) : line.slice(0, 5)).trim().toUpperCase();
    const target = isMod ? mods : codes;
    if (!(isMod ? /^[A-Z0-9]{2}$/ : /^[A-Z][0-9]{4}$/).test(code)) continue;
    const long = line.slice(11, 91).trim();
    if (rec === "3" || rec === "7") {
      target.set(code, {
        code,
        longDescription: long,
        shortDescription: line.slice(91, 119).trim() || long.slice(0, 28),
        addedDate: ymd(line.slice(268, 276)),
        effectiveDate: ymd(line.slice(276, 284)),
        terminationDate: ymd(line.slice(284, 292)),
        actionCode: line.slice(292, 293).trim(),
      });
    } else if (rec === "4" || rec === "8") {
      const row = target.get(code);
      if (row && long) row.longDescription = `${row.longDescription} ${long}`;
    }
  }
  return { codes: [...codes.values()], modifiers: [...mods.values()] };
}

export type IcdRow = { code: string; billable: boolean; shortDescription: string; description: string };

/** ICD-10-CM order file: order(1-5) code(7-13, no dot) flag(15: 1 = valid on claims, 0 = header) short(17-76) long(78-). */
export function parseIcd10Order(text: string): IcdRow[] {
  const out: IcdRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 18) continue;
    const raw = line.slice(6, 13).trim().toUpperCase();
    if (!/^[A-Z][0-9A-Z][0-9A-Z]{1,5}$/.test(raw)) continue; // 2nd character can be a letter (e.g. QA0)
    const code = raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
    const shortDescription = line.slice(16, 76).trim();
    out.push({ code, billable: line[14] === "1", shortDescription, description: line.slice(77).trim() || shortDescription });
  }
  return out;
}

/** Find the data file inside an official zip. */
export function entryFromZip(zip: Uint8Array, codeSet: CodeSet): { name: string; text: string } {
  const files = unzipSync(zip);
  const pick = Object.keys(files).find((n) =>
    codeSet === "hcpcs" ? /ANWEB[^/]*\.txt$/i.test(n) && !/transaction|correction/i.test(n) : /icd10cm[-_]order[-_]\d{4}\.txt$/i.test(n),
  );
  if (!pick) throw new Error(`No ${codeSet === "hcpcs" ? "HCPCS ANWEB .txt" : "ICD-10-CM order .txt"} file in this zip (found: ${Object.keys(files).join(", ")})`);
  return { name: pick, text: Buffer.from(files[pick]).toString("latin1") };
}

// ---- Loaders ---------------------------------------------------------------------------------

type LoadResult = { added: number; changed: number; retired: number };

async function loadHcpcs(file: OfficialFile, text: string): Promise<LoadResult> {
  const { codes, modifiers: mods } = parseHcpcs(text);
  if (codes.length < 1000) throw new Error(`Only ${codes.length} HCPCS codes found. Is this the right file?`);
  const source = `CMS HCPCS ${file.version} (${file.file})`;
  const db = getControlDb();
  const r: LoadResult = { added: 0, changed: 0, retired: 0 };
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(hcpcsCodes).where(like(hcpcsCodes.source, "CMS%"));
    const byCode = new Map(existing.map((e) => [e.code, e]));
    const inserts: (typeof hcpcsCodes.$inferInsert)[] = [];
    for (const c of codes) {
      const effectiveFrom = c.addedDate ?? c.effectiveDate;
      const cur = byCode.get(c.code);
      const values = { shortDescription: c.shortDescription, longDescription: c.longDescription, effectiveTo: c.terminationDate, source };
      if (!cur) inserts.push({ code: c.code, effectiveFrom, ...values });
      else if (cur.shortDescription !== c.shortDescription || cur.longDescription !== c.longDescription || cur.effectiveTo !== c.terminationDate) {
        await tx.update(hcpcsCodes).set({ ...values, loadedAt: new Date() }).where(eq(hcpcsCodes.id, cur.id));
        if (!cur.effectiveTo && c.terminationDate) r.retired++;
        else r.changed++;
      }
    }
    for (let i = 0; i < inserts.length; i += BATCH) await tx.insert(hcpcsCodes).values(inserts.slice(i, i + BATCH)).onConflictDoNothing();
    r.added = inserts.length;
    for (const m of mods) {
      const values = { description: m.longDescription || m.shortDescription, effectiveFrom: m.addedDate ?? m.effectiveDate, effectiveTo: m.terminationDate, source };
      await tx.insert(modifiers).values({ code: m.code, ...values }).onConflictDoUpdate({ target: modifiers.code, set: values });
    }
    // The small unverified starter list is no longer needed once the official file is in.
    await tx.delete(hcpcsCodes).where(like(hcpcsCodes.source, "STARTER%"));
    await tx.delete(modifiers).where(like(modifiers.source, "STARTER%"));
  });
  return r;
}

async function loadIcd10(file: OfficialFile, text: string): Promise<LoadResult> {
  const rows = parseIcd10Order(text);
  if (rows.length < 50000) throw new Error(`Only ${rows.length} ICD-10-CM codes found. Is this the right file?`);
  const source = `CDC/NCHS ICD-10-CM ${file.version} (${file.file})`;
  const start = file.effectiveFrom;
  const end = dayBefore(start);
  const db = getControlDb();
  const r: LoadResult = { added: 0, changed: 0, retired: 0 };
  await db.transaction(async (tx) => {
    const open = await tx.select().from(icd10Codes).where(and(like(icd10Codes.source, "CDC%"), isNull(icd10Codes.effectiveTo)));
    const latest = open.reduce((m, o) => (o.effectiveFrom && o.effectiveFrom > m ? o.effectiveFrom : m), "");
    if (latest && latest >= start) throw new Error(`ICD-10-CM ${file.version} (from ${start}) is not newer than what's loaded (from ${latest}). Load fiscal years in order.`);
    const byCode = new Map(open.map((o) => [o.code, o]));
    const seen = new Set<string>();
    const inserts: (typeof icd10Codes.$inferInsert)[] = [];
    const close: number[] = [];
    for (const row of rows) {
      seen.add(row.code);
      const cur = byCode.get(row.code);
      if (cur && cur.description === row.description && cur.shortDescription === row.shortDescription && cur.billable === row.billable) continue;
      if (cur) {
        close.push(cur.id);
        r.changed++;
      } else r.added++;
      inserts.push({ ...row, effectiveFrom: start, source });
    }
    for (const o of open) if (!seen.has(o.code)) { close.push(o.id); r.retired++; }
    for (let i = 0; i < close.length; i += BATCH) await tx.update(icd10Codes).set({ effectiveTo: end }).where(inArray(icd10Codes.id, close.slice(i, i + BATCH)));
    for (let i = 0; i < inserts.length; i += BATCH) await tx.insert(icd10Codes).values(inserts.slice(i, i + BATCH));
    await tx.delete(icd10Codes).where(like(icd10Codes.source, "STARTER%"));
  });
  return r;
}

/** Load one official zip (skipped if this exact file was already loaded). */
export async function loadOfficialZip(file: OfficialFile, zip: Uint8Array, loadedBy: string) {
  const db = getControlDb();
  const hash = sha(zip);
  if (file.sha256 && file.sha256 !== hash) throw new Error(`${file.file} doesn't match its recorded fingerprint (SHA-256). Not loading it.`);
  const [already] = await db.select().from(codeSetLoads).where(and(eq(codeSetLoads.codeSet, file.codeSet), eq(codeSetLoads.sha256, hash)));
  if (already) return { skipped: true as const, ...already };
  const { name, text } = entryFromZip(zip, file.codeSet);
  const result = file.codeSet === "hcpcs" ? await loadHcpcs(file, text) : await loadIcd10(file, text);
  const [row] = await db.insert(codeSetLoads).values({ codeSet: file.codeSet, version: file.version, effectiveFrom: file.effectiveFrom, sourceUrl: file.sourceUrl, fileName: `${file.file} > ${name}`, sha256: hash, ...result, loadedBy }).returning();
  return { skipped: false as const, ...row };
}

// ---- The official files that ship with the app -----------------------------------------------

export const OFFICIAL_DIR = path.resolve(import.meta.dirname, "..", "..", "codesets", "official");

export function bundledFiles(): OfficialFile[] {
  const manifest = path.join(OFFICIAL_DIR, "manifest.json");
  if (!fs.existsSync(manifest)) return [];
  return (JSON.parse(fs.readFileSync(manifest, "utf8")) as OfficialFile[]).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/** At start-up: load any bundled official file that isn't in yet (only the first time, or after an update ships). */
export async function ensureOfficialCodeSets(log: (m: string) => void = console.log) {
  const db = getControlDb();
  const loads = await db.select().from(codeSetLoads);
  for (const f of bundledFiles()) {
    if (loads.some((l) => l.sha256 === f.sha256)) continue;
    // Never go backwards: skip a bundled file if a newer one of the same set was already loaded (e.g. via an update).
    if (loads.some((l) => l.codeSet === f.codeSet && l.effectiveFrom > f.effectiveFrom)) continue;
    log(`  Loading official ${f.codeSet === "hcpcs" ? "HCPCS" : "ICD-10-CM"} ${f.version} codes (one time, may take a minute)…`);
    const r = await loadOfficialZip(f, fs.readFileSync(path.join(OFFICIAL_DIR, f.file)), "SYSTEM (bundled file)");
    if (!r.skipped) log(`    ${r.added} added, ${r.changed} changed, ${r.retired} retired.`);
  }
}

/** Summary for Settings → Codes. */
export async function codeSetStatus() {
  const db = getControlDb();
  const loads = await db.select().from(codeSetLoads).orderBy(sql`${codeSetLoads.loadedAt} desc`);
  const [h] = await db.select({ n: sql<number>`count(*)::int` }).from(hcpcsCodes);
  const [i] = await db.select({ n: sql<number>`count(*)::int`, billable: sql<number>`count(*) filter (where ${icd10Codes.billable} and ${icd10Codes.effectiveTo} is null)::int` }).from(icd10Codes);
  const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(modifiers);
  return { loads, counts: { hcpcs: h.n, icd10: i.n, icd10BillableNow: i.billable, modifiers: m.n } };
}

/**
 * Are these codes valid on the date of service? Returns plain-English problems (empty = all good).
 * HCPCS and modifiers must exist and be in effect; ICD-10-CM must also be billable (not a category header).
 */
export async function codeProblems(dateOfService: string, codes: { hcpcs: string[]; modifiers: string[]; icd10: string[] }) {
  const db = getControlDb();
  const inEffect = <T extends { effectiveFrom: string | null; effectiveTo: string | null }>(r: T) => (!r.effectiveFrom || r.effectiveFrom <= dateOfService) && (!r.effectiveTo || r.effectiveTo >= dateOfService);
  const problems: string[] = [];
  const uniq = (a: string[]) => [...new Set(a.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const h = uniq(codes.hcpcs), m = uniq(codes.modifiers), d = uniq(codes.icd10);
  const hRows = h.length ? await db.select().from(hcpcsCodes).where(inArray(hcpcsCodes.code, h)) : [];
  for (const c of h) {
    const rows = hRows.filter((r) => r.code === c);
    if (!rows.length) problems.push(`HCPCS ${c} isn't in the HCPCS code list.`);
    else if (!rows.some(inEffect)) problems.push(`HCPCS ${c} wasn't valid on ${dateOfService} (in effect ${rows.map((r) => `${r.effectiveFrom ?? "…"} to ${r.effectiveTo ?? "now"}`).join(", ")}).`);
  }
  const mRows = m.length ? await db.select().from(modifiers).where(inArray(modifiers.code, m)) : [];
  for (const c of m) {
    const row = mRows.find((r) => r.code === c);
    if (!row) problems.push(`Modifier ${c} isn't in the modifier list.`);
    else if (!inEffect(row)) problems.push(`Modifier ${c} wasn't valid on ${dateOfService}.`);
  }
  const dRows = d.length ? await db.select().from(icd10Codes).where(inArray(icd10Codes.code, d)) : [];
  for (const c of d) {
    const rows = dRows.filter((r) => r.code === c);
    const current = rows.find(inEffect);
    if (!rows.length) problems.push(`ICD-10 ${c} isn't in the ICD-10-CM code list.`);
    else if (!current) problems.push(`ICD-10 ${c} wasn't valid on ${dateOfService}.`);
    else if (!current.billable) problems.push(`ICD-10 ${c} is a category, not a billable code. Pick a more specific code under it.`);
  }
  return problems;
}

// ---- Updates straight from CMS / CDC ----------------------------------------------------------

const CMS_HCPCS_PAGE = "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update";
const CDC_ICD10CM_DIR = "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/";
const MONTHS: Record<string, string> = { january: "01", april: "04", july: "07", october: "10" };

async function fetchText(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "CaliberDMEBilling code-set updater" } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
}
async function fetchBytes(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "CaliberDMEBilling code-set updater" } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** The newest quarterly HCPCS file listed on CMS's quarterly update page. */
export async function latestHcpcsOnline(): Promise<Omit<OfficialFile, "sha256">> {
  const html = await fetchText(CMS_HCPCS_PAGE);
  const found = [...html.matchAll(/\/files\/zip\/(january|april|july|october)-(\d{4})-alpha-numeric-hcpcs-files?\.zip/gi)].map((m) => ({ path: m[0], year: m[2], month: MONTHS[m[1].toLowerCase()] }));
  if (!found.length) throw new Error("Couldn't find a HCPCS file on the CMS quarterly update page.");
  const best = found.sort((a, b) => `${b.year}${b.month}`.localeCompare(`${a.year}${a.month}`))[0];
  return { codeSet: "hcpcs", version: `${best.year}-${best.month}`, effectiveFrom: `${best.year}-${best.month}-01`, sourceUrl: `https://www.cms.gov${best.path}`, file: best.path.split("/").pop()! };
}

/** ICD-10-CM fiscal-year releases on the CDC/NCHS server, newest last. FY N starts October 1 of year N-1. */
export async function icd10YearsOnline(): Promise<Omit<OfficialFile, "sha256">[]> {
  const root = await fetchText(CDC_ICD10CM_DIR);
  const years = [...new Set([...root.matchAll(/ICD10CM\/(\d{4})\//g)].map((m) => Number(m[1])))].sort();
  const out: Omit<OfficialFile, "sha256">[] = [];
  for (const y of years.filter((y) => y >= 2026)) {
    const list = await fetchText(`${CDC_ICD10CM_DIR}${y}/`);
    const m = /HREF="([^"]*code[%20 _-]*descriptions[^"]*\.zip)"/i.exec(list);
    if (!m) continue;
    out.push({ codeSet: "icd10cm", version: `FY${y}`, effectiveFrom: `${y - 1}-10-01`, sourceUrl: new URL(m[1], "https://ftp.cdc.gov").toString(), file: decodeURIComponent(m[1].split("/").pop()!) });
  }
  return out;
}

/** Download and load anything newer than what's loaded. Used by Settings → Codes and `npm run codes:update`. */
export async function updateFromOfficialSources(loadedBy: string, log: (m: string) => void) {
  const db = getControlDb();
  const loads = await db.select().from(codeSetLoads);
  const latest = (set: CodeSet) => loads.filter((l) => l.codeSet === set).reduce((m, l) => (l.effectiveFrom > m ? l.effectiveFrom : m), "");
  let loaded = 0;

  log("Checking CDC for new ICD-10-CM fiscal years…");
  for (const f of (await icd10YearsOnline()).filter((f) => f.effectiveFrom > latest("icd10cm"))) {
    log(`Downloading ICD-10-CM ${f.version} from ${f.sourceUrl}`);
    const r = await loadOfficialZip({ ...f, sha256: "" }, await fetchBytes(f.sourceUrl), loadedBy);
    log(r.skipped ? `ICD-10-CM ${f.version} was already loaded.` : `ICD-10-CM ${f.version}: ${r.added} added, ${r.changed} changed, ${r.retired} retired.`);
    if (!r.skipped) loaded++;
  }

  log("Checking CMS for a new quarterly HCPCS file…");
  const h = await latestHcpcsOnline();
  if (h.effectiveFrom > latest("hcpcs")) {
    log(`Downloading HCPCS ${h.version} from ${h.sourceUrl}`);
    const r = await loadOfficialZip({ ...h, sha256: "" }, await fetchBytes(h.sourceUrl), loadedBy);
    log(r.skipped ? `HCPCS ${h.version} was already loaded.` : `HCPCS ${h.version}: ${r.added} added, ${r.changed} changed, ${r.retired} retired.`);
    if (!r.skipped) loaded++;
  } else log(`HCPCS is up to date (${latest("hcpcs").slice(0, 7)}).`);

  log(loaded ? `Done: ${loaded} new file${loaded > 1 ? "s" : ""} loaded.` : "Everything is already up to date.");
  return loaded;
}
