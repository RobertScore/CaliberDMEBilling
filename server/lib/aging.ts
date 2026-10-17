// Aging: how old is what's owed? Everything on a claim (charges, payments, write-offs) ages from that
// claim's date of service, so a payment lands in the same bucket as the charge it pays.
// Entries not tied to a claim age from their own service date, or else their posting date.
export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "91-120", "121+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

type Entry = { encounterId: number | null; serviceDateFrom: string | null; postDate: string; insuranceDeltaCents: number; patientDeltaCents: number };

export function agingBucket(fromDate: string, asOf: string): AgingBucket {
  const days = Math.floor((Date.parse(asOf) - Date.parse(fromDate)) / 86400000);
  return days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : days <= 120 ? "91-120" : "121+";
}

export function ageEntries(entries: Entry[], serviceDateByEncounter: Map<number, string>, asOf: string): Record<AgingBucket, number> {
  const out = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  for (const e of entries) {
    const from = (e.encounterId != null ? serviceDateByEncounter.get(e.encounterId) : undefined) ?? e.serviceDateFrom ?? e.postDate;
    out[agingBucket(from, asOf)] += e.insuranceDeltaCents + e.patientDeltaCents;
  }
  return out;
}
