// Is this paperwork for a patient we already have? Scores possible matches inside ONE client only.
import { isNull } from "drizzle-orm";
import { patients, patientInsurances } from "@shared/schema/tenant";
import type { Tenant } from "../db/tenantDb";

export type MatchInput = { lastName?: string | null; firstName?: string | null; dob?: string | null; ssnLast4?: string | null; phone?: string | null; claimNumber?: string | null; memberIdLast4?: string | null };
export type MatchCandidate = { patientId: number; accountNumber: string; lastName: string; firstName: string; dob: string; score: number; reasons: string[] };

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Score 0-100. 80+ means "very likely the same person": staff must decide before filing. */
export async function findMatches(tenant: Tenant, input: MatchInput): Promise<MatchCandidate[]> {
  const rows = await tenant.db.select().from(patients).where(isNull(patients.removedAt));
  const ins = await tenant.db.select().from(patientInsurances);
  const L = norm(input.lastName), F = norm(input.firstName);
  const out: MatchCandidate[] = [];
  for (const p of rows) {
    const reasons: string[] = [];
    let score = 0;
    const pl = norm(p.lastName), pf = norm(p.firstName);
    const sameDob = !!input.dob && input.dob === p.dob;
    const lastExact = !!L && L === pl;
    const lastClose = !!L && !lastExact && L.length > 2 && editDistance(L, pl) <= 2;
    const firstMatch = !!F && (F === pf || pf.startsWith(F) || F.startsWith(pf));
    if (sameDob) { score += 45; reasons.push("Same date of birth"); }
    if (lastExact) { score += 30; reasons.push("Same last name"); } else if (lastClose) { score += 18; reasons.push("Similar last name"); }
    if (firstMatch) { score += 15; reasons.push("Same first name"); }
    if (input.ssnLast4 && p.ssnLast4 && input.ssnLast4 === p.ssnLast4) { score += 25; reasons.push("SSN last 4 match"); }
    if (digits(input.phone).length >= 7 && [p.phone, p.cellPhone].some((x) => digits(x) && digits(x).endsWith(digits(input.phone).slice(-7)))) { score += 10; reasons.push("Same phone"); }
    const theirIns = ins.filter((i) => i.patientId === p.id);
    if (input.claimNumber && theirIns.some((i) => norm(i.claimNumber) === norm(input.claimNumber))) { score += 35; reasons.push("Same claim number"); }
    if (input.memberIdLast4 && theirIns.some((i) => i.memberIdLast4 === input.memberIdLast4)) { score += 10; reasons.push("Member ID last 4 match"); }
    if (score >= 40) out.push({ patientId: p.id, accountNumber: p.accountNumber, lastName: p.lastName, firstName: p.firstName, dob: p.dob, score: Math.min(score, 100), reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
