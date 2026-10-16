// Dates of service, DOB and deposit dates are plain calendar dates ("YYYY-MM-DD"),
// never timestamps, so they can't shift with time zones. (CLAUDE.md 10)

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Smart date entry from the spec: "010101" -> "01/01/01", "01011980" -> "01/01/1980".
 * Returns the display text with slashes added.
 */
export function autoSlashDate(typed: string): string {
  const digits = typed.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * "MM/DD/YY" or "MM/DD/YYYY" -> "YYYY-MM-DD". Two-digit years: 00 up to the current
 * two-digit year are 20xx, the rest 19xx (so a DOB of "01/01/80" is 1980).
 */
export function displayToIso(display: string, today = new Date()): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(display.trim());
  if (!m) return null;
  let year = Number(m[3]);
  if (m[3].length === 2) {
    const cutoff = today.getFullYear() % 100;
    year += year <= cutoff ? 2000 : 1900;
  }
  const iso = `${String(year).padStart(4, "0")}-${m[1]}-${m[2]}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = ISO.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

/** Age in whole years on a given date. */
export function ageOn(dobIso: string, onIso: string): number {
  const [by, bm, bd] = dobIso.split("-").map(Number);
  const [y, m, d] = onIso.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
