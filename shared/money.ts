// Money is always whole cents (integers). Never floating point. (CLAUDE.md 3.3)

/** "1,250.5" -> 125050. Returns null if it isn't a valid amount. */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim().replace(/[$,\s]/g, "");
  if (s === "") return null;
  const m = /^(-)?(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[2]);
  const frac = Number((m[3] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return null;
  return m[1] ? -cents : cents;
}

/** 125050 -> "1,250.50"; -5000 -> "-50.00" */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("Money must be whole cents");
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const rest = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${dollars}.${rest}`;
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
