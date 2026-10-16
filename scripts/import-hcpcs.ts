// Load the official HCPCS Level II code list from CMS into the control database.
// Download the quarterly HCPCS file from cms.gov, open the Excel file, save it as CSV, then run:
//   npm run import:hcpcs -- path/to/HCPC2026_OCT.csv
// Needs the columns HCPC, SHORT DESCRIPTION and LONG DESCRIPTION. Uses ACT EFF DT / TERM DT when present.
import fs from "node:fs";
import path from "node:path";
import { like } from "drizzle-orm";
import { openControlDb, closeControlDb } from "../server/db/control";
import { hcpcsCodes } from "@shared/schema/control";

/** Minimal CSV reader (handles quoted fields with commas and doubled quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** CMS dates look like 20260101 or 1/1/2026. Returns YYYY-MM-DD or undefined. */
export function cmsDate(s: string | undefined): string | undefined {
  const t = (s ?? "").trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return undefined;
}

export function hcpcsRowsFromCsv(text: string) {
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => r.some((c) => /^HCPC/i.test(c.trim())));
  if (headerIdx < 0) throw new Error("Couldn't find the HCPC column header");
  const h = rows[headerIdx].map((c) => c.trim().toUpperCase());
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const cCode = col(/^HCPC/), cShort = col(/SHORT/), cLong = col(/LONG/), cEff = col(/EFF/), cTerm = col(/TERM/);
  if (cCode < 0 || cShort < 0) throw new Error("Need HCPC and SHORT DESCRIPTION columns");
  const out = new Map<string, { code: string; shortDescription: string; longDescription?: string; effectiveFrom?: string; effectiveTo?: string }>();
  for (const r of rows.slice(headerIdx + 1)) {
    const code = (r[cCode] ?? "").trim().toUpperCase();
    if (!/^[A-Z][0-9]{4}$/.test(code)) continue;
    const prev = out.get(code);
    // CMS long descriptions can span several rows for the same code: join them.
    const longPart = cLong >= 0 ? (r[cLong] ?? "").trim() : "";
    if (prev) { if (longPart) prev.longDescription = `${prev.longDescription ?? ""} ${longPart}`.trim(); continue; }
    out.set(code, {
      code,
      shortDescription: (r[cShort] ?? "").trim(),
      longDescription: longPart || undefined,
      effectiveFrom: cEff >= 0 ? cmsDate(r[cEff]) : undefined,
      effectiveTo: cTerm >= 0 ? cmsDate(r[cTerm]) : undefined,
    });
  }
  return [...out.values()];
}

async function main() {
  const [file] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: npm run import:hcpcs -- <HCPCS file saved as .csv>");
    process.exit(1);
  }
  const rows = hcpcsRowsFromCsv(fs.readFileSync(file, "utf8"));
  if (rows.length < 1000) throw new Error(`Only ${rows.length} codes found. Is this the right file?`);
  const db = await openControlDb();
  const source = `CMS HCPCS file ${path.basename(file)}`;
  await db.delete(hcpcsCodes).where(like(hcpcsCodes.source, "STARTER%"));
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await db.insert(hcpcsCodes).values(rows.slice(i, i + 500).map((r) => ({ ...r, source }))).onConflictDoNothing().returning({ id: hcpcsCodes.id });
    added += res.length;
  }
  console.log(`Loaded ${added} HCPCS codes from ${source}.`);
  await closeControlDb();
}

if (process.argv[1]?.endsWith("import-hcpcs.ts")) main();
