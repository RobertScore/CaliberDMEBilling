// Load the official ICD-10-CM code list from CMS into the control database.
// Download "ICD-10-CM Code Descriptions" from cms.gov, unzip it, then run:
//   npm run import:icd10 -- path/to/icd10cm_codes_2026.txt 2025-10-01
// Each line of that file is: code (no dot), spaces, description.
import fs from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { openControlDb, closeControlDb } from "../server/db/control";
import { icd10Codes } from "@shared/schema/control";

export function parseIcd10Line(line: string): { code: string; description: string } | null {
  const m = /^([A-Z][0-9][0-9A-Z][0-9A-Z]{0,4})\s+(.+?)\s*$/.exec(line);
  if (!m) return null;
  const raw = m[1];
  const code = raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
  return { code, description: m[2] };
}

async function main() {
  const [file, effectiveFrom] = process.argv.slice(2);
  if (!file || !effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    console.error("Usage: npm run import:icd10 -- <icd10cm_codes_YYYY.txt> <effective date YYYY-MM-DD>");
    process.exit(1);
  }
  const db = await openControlDb();
  const source = `CMS ICD-10-CM file ${path.basename(file)}`;
  const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).map(parseIcd10Line).filter((r) => r !== null);
  if (rows.length < 1000) throw new Error(`Only ${rows.length} codes found. Is this the right file?`);
  await db.delete(icd10Codes).where(like(icd10Codes.source, "STARTER%"));
  let added = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000).map((r) => ({ ...r, effectiveFrom, source }));
    const res = await db.insert(icd10Codes).values(batch).onConflictDoNothing().returning({ id: icd10Codes.id });
    added += res.length;
  }
  const [check] = await db.select().from(icd10Codes).where(and(eq(icd10Codes.source, source))).limit(1);
  console.log(`Loaded ${added} ICD-10-CM codes (effective ${effectiveFrom}) from ${source}. Example: ${check?.code} ${check?.description}`);
  await closeControlDb();
}

if (process.argv[1]?.endsWith("import-icd10.ts")) main();
