import { describe, expect, it } from "vitest";
import { ageEntries, agingBucket } from "../server/lib/aging";

describe("aging", () => {
  it("puts days into the right 30-day bucket", () => {
    expect(agingBucket("2026-10-01", "2026-10-31")).toBe("0-30");
    expect(agingBucket("2026-10-01", "2026-11-01")).toBe("31-60");
    expect(agingBucket("2026-01-01", "2026-10-31")).toBe("121+");
  });

  it("ages a payment with the claim it pays, not the day it was posted", () => {
    const claims = new Map([[1, "2026-08-25"]]);
    const aged = ageEntries(
      [
        { encounterId: 1, serviceDateFrom: "2026-08-25", postDate: "2026-08-26", insuranceDeltaCents: 340000, patientDeltaCents: 0 },
        { encounterId: 1, serviceDateFrom: null, postDate: "2026-10-16", insuranceDeltaCents: -250000, patientDeltaCents: 0 },
      ],
      claims,
      "2026-10-16",
    );
    expect(aged["31-60"]).toBe(90000);
    expect(aged["0-30"]).toBe(0);
  });

  it("falls back to the posting date for entries not on a claim", () => {
    const aged = ageEntries([{ encounterId: null, serviceDateFrom: null, postDate: "2026-10-10", insuranceDeltaCents: 0, patientDeltaCents: -1500 }], new Map(), "2026-10-16");
    expect(aged["0-30"]).toBe(-1500);
  });
});
