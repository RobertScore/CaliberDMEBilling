// Drop-down lists Caliber can edit in Settings (control database, no PHI).
import { and, asc, eq } from "drizzle-orm";
import { getControlDb } from "../db/control";
import { picklistItems } from "@shared/schema/control";
import { PAT_SHARE_TYPES, PAYMENT_TYPES, WRITEOFF_TYPES } from "@shared/picklists";
import { NOTE_CATEGORIES } from "@shared/permissions";

export const LISTS = {
  writeoff: { label: "Write-off reasons", defaults: WRITEOFF_TYPES.map((w) => ({ code: w.code, label: w.label })) },
  pat_share: { label: "Patient share reasons", defaults: PAT_SHARE_TYPES.map((w) => ({ code: w.code, label: w.label })) },
  note_category: { label: "Note categories", defaults: NOTE_CATEGORIES.map((c) => ({ code: c.code, label: c.label })) },
  payment_type: { label: "Payment types", defaults: PAYMENT_TYPES.map((p) => ({ code: p, label: p })) },
} as const;
export type ListName = keyof typeof LISTS;

export async function listItems(list: ListName, includeInactive = false) {
  const rows = await getControlDb().select().from(picklistItems).where(eq(picklistItems.list, list)).orderBy(asc(picklistItems.sortOrder), asc(picklistItems.id));
  return includeInactive ? rows : rows.filter((r) => r.active);
}

export async function findItem(list: ListName, code: string) {
  const [row] = await getControlDb().select().from(picklistItems).where(and(eq(picklistItems.list, list), eq(picklistItems.code, code), eq(picklistItems.active, true)));
  return row ?? null;
}

export async function seedLists() {
  const db = getControlDb();
  for (const [list, def] of Object.entries(LISTS)) {
    const existing = await db.select().from(picklistItems).where(eq(picklistItems.list, list));
    if (existing.length) continue;
    await db.insert(picklistItems).values(def.defaults.map((d, i) => ({ list, code: d.code, label: d.label, sortOrder: i })));
  }
}
