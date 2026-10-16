// The CMS files couldn't be downloaded while building this, so these tests use small samples in the
// documented formats. Run the real import once and spot-check codes before relying on it.
import { parseIcd10Line } from "../scripts/import-icd10";
import { cmsDate, hcpcsRowsFromCsv, parseCsv } from "../scripts/import-hcpcs";

describe("code set importers", () => {
  it("reads ICD-10-CM code lines and adds the dot", () => {
    expect(parseIcd10Line("M25561  Pain in right knee")).toEqual({ code: "M25.561", description: "Pain in right knee" });
    expect(parseIcd10Line("A00     Cholera")).toEqual({ code: "A00", description: "Cholera" });
    expect(parseIcd10Line("")).toBeNull();
  });
  it("reads quoted CSV", () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,2,3\n')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
  });
  it("reads CMS dates", () => {
    expect(cmsDate("20260101")).toBe("2026-01-01");
    expect(cmsDate("1/5/2026")).toBe("2026-01-05");
    expect(cmsDate("")).toBeUndefined();
  });
  it("reads HCPCS rows, joining long descriptions that span rows", () => {
    const csv = [
      "Some title row",
      "HCPC,SEQNUM,LONG DESCRIPTION,SHORT DESCRIPTION,ACT EFF DT,TERM DT",
      "E0218,00100,Water circulating cold pad with pump,Water circ cold pad w pump,20020101,",
      "E0218,00200,(continued text),,,",
      "NOTACODE,1,x,y,,",
    ].join("\n");
    const rows = hcpcsRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: "E0218", shortDescription: "Water circ cold pad w pump", effectiveFrom: "2002-01-01" });
    expect(rows[0].longDescription).toBe("Water circulating cold pad with pump (continued text)");
  });
});
