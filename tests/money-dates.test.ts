import { formatCents, parseDollarsToCents } from "@shared/money";
import { ageOn, autoSlashDate, displayToIso, isValidIsoDate } from "@shared/dates";

describe("money is whole cents", () => {
  it.each([
    ["250", 25000],
    ["250.5", 25050],
    ["1,250.05", 125005],
    ["$3,150.00", 315000],
    ["0.10", 10],
    ["-50", -5000],
  ])("parses %s", (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it.each(["", "abc", "1.234", "1.2.3"])("rejects %s", (input) => expect(parseDollarsToCents(input)).toBeNull());

  it("formats", () => {
    expect(formatCents(125005)).toBe("1,250.05");
    expect(formatCents(-5000)).toBe("-50.00");
    expect(formatCents(7)).toBe("0.07");
    expect(() => formatCents(1.5)).toThrow();
  });

  it("never drifts the way floating point does", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in cents it is exact.
    expect(parseDollarsToCents("0.10")! + parseDollarsToCents("0.20")!).toBe(parseDollarsToCents("0.30"));
  });
});

describe("dates", () => {
  it("adds slashes as you type (spec: 010101 -> 01/01/01)", () => {
    expect(autoSlashDate("010101")).toBe("01/01/01");
    expect(autoSlashDate("01011980")).toBe("01/01/1980");
    expect(autoSlashDate("0101")).toBe("01/01");
  });
  it("reads two- and four-digit years", () => {
    const today = new Date(2026, 9, 16);
    expect(displayToIso("01/01/80", today)).toBe("1980-01-01");
    expect(displayToIso("01/01/01", today)).toBe("2001-01-01");
    expect(displayToIso("02/30/2020", today)).toBeNull();
  });
  it("validates and computes age", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2023-02-29")).toBe(false);
    expect(ageOn("1980-10-17", "2026-10-16")).toBe(45);
    expect(ageOn("1980-10-16", "2026-10-16")).toBe(46);
  });
});
