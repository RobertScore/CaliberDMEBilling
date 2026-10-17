// Official code sets: parsing the CMS/CDC files, loading them with dates, and checking codes on a date of service.
import fs from "node:fs";
import path from "node:path";
import { setup, login } from "./helpers";
import { OFFICIAL_DIR, bundledFiles, codeProblems, codeSetStatus, entryFromZip, loadOfficialZip, parseHcpcs, parseIcd10Order } from "../server/lib/codesets";

const zip = (file: string) => fs.readFileSync(path.join(OFFICIAL_DIR, file));
let ctx: Awaited<ReturnType<typeof setup>>;

beforeAll(async () => {
  ctx = await setup();
  for (const f of bundledFiles()) await loadOfficialZip(f, zip(f.file), "test");
}, 240_000);

describe("reading the official files", () => {
  it("reads HCPCS records, joining continuation lines and keeping CMS dates", () => {
    const hcpcs = bundledFiles().find((f) => f.codeSet === "hcpcs")!;
    const { codes, modifiers } = parseHcpcs(entryFromZip(zip(hcpcs.file), "hcpcs").text);
    expect(codes).toHaveLength(8770);
    expect(modifiers).toHaveLength(384);
    const l1833 = codes.find((c) => c.code === "L1833")!;
    expect(l1833.longDescription).toBe("Knee orthosis, adjustable knee joints (unicentric or polycentric), positional orthosis, rigid support, prefabricated, off-the shelf"); // two lines joined
    expect(codes.find((c) => c.code === "E0450")).toMatchObject({ addedDate: "1985-01-01", terminationDate: "2015-12-31" });
    expect(modifiers.find((m) => m.code === "RT")!.longDescription).toMatch(/^Right side/);
    expect(codes.some((c) => /^\d/.test(c.code))).toBe(false); // no CPT (AMA-licensed) codes
  });

  it("reads the ICD-10-CM order file: dots added, headers marked not billable, letter 2nd characters kept", () => {
    const fy27 = bundledFiles().find((f) => f.version === "FY2027")!;
    const rows = parseIcd10Order(entryFromZip(zip(fy27.file), "icd10cm").text);
    expect(rows.filter((r) => r.billable)).toHaveLength(74879);
    expect(rows.find((r) => r.code === "S83.511A")).toMatchObject({ billable: true, description: "Sprain of anterior cruciate ligament of right knee, initial encounter" });
    expect(rows.find((r) => r.code === "S83.5")!.billable).toBe(false);
    expect(rows.find((r) => r.code === "QA0")!.billable).toBe(false);
  });
});

describe("loading and versioning", () => {
  it("loads every code once, records each load, and replaces the starter list", async () => {
    const st = await codeSetStatus();
    expect(st.counts).toMatchObject({ hcpcs: 8770, modifiers: 384, icd10: 98186 + 238 + 19, icd10BillableNow: 74879 });
    expect(st.loads.map((l) => `${l.codeSet} ${l.version} +${l.added} ~${l.changed} -${l.retired}`).sort()).toEqual(["hcpcs 2026-10 +8770 ~0 -0", "icd10cm FY2026 +98186 ~0 -0", "icd10cm FY2027 +238 ~19 -21"]);
    expect(st.loads.every((l) => l.sourceUrl.startsWith("https://") && l.sha256.length === 64)).toBe(true);
  });

  it("loading the same file again does nothing, and a file with the wrong fingerprint is refused", async () => {
    const f = bundledFiles()[0];
    expect((await loadOfficialZip(f, zip(f.file), "test")).skipped).toBe(true);
    await expect(loadOfficialZip({ ...f, sha256: "0".repeat(64) }, zip(f.file), "test")).rejects.toThrow(/fingerprint/);
  });

  it("checks codes against the date of service", async () => {
    expect(await codeProblems("2026-10-15", { hcpcs: ["E0218", "L1833"], modifiers: ["RT", "NU"], icd10: ["S83.511A", "M25.561"] })).toEqual([]);
    // Retired in FY2027: fine for a May 2026 service, not for October 2026.
    expect(await codeProblems("2026-05-01", { hcpcs: [], modifiers: [], icd10: ["S23.420A"] })).toEqual([]);
    expect((await codeProblems("2026-10-15", { hcpcs: [], modifiers: [], icd10: ["S23.420A"] }))[0]).toMatch(/wasn't valid on 2026-10-15/);
    // D69.1 was billable in FY2026 and became a category (D69.11 / D69.19) in FY2027.
    expect(await codeProblems("2026-05-01", { hcpcs: [], modifiers: [], icd10: ["D69.1"] })).toEqual([]);
    expect((await codeProblems("2026-10-15", { hcpcs: [], modifiers: [], icd10: ["D69.1"] }))[0]).toMatch(/category, not a billable code/);
    expect((await codeProblems("2026-10-15", { hcpcs: ["E0450", "Z9999"], modifiers: ["ZZ"], icd10: ["QA0"] }))).toEqual([
      expect.stringMatching(/E0450 wasn't valid/), expect.stringMatching(/Z9999 isn't in/), expect.stringMatching(/Modifier ZZ isn't in/), expect.stringMatching(/QA0 is a category/),
    ]);
  });
});

describe("in the app", () => {
  it("search matches words in the full description and only shows codes valid on the date", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const knee = (await biller.get("/api/codes/hcpcs?q=knee%20orthosis%20adjustable").expect(200)).body as { code: string }[];
    expect(knee.map((c) => c.code)).toContain("L1833");
    const exact = (await biller.get("/api/codes/icd10?q=S83.511A").expect(200)).body as { code: string }[];
    expect(exact[0].code).toBe("S83.511A");
    const retiredNow = (await biller.get("/api/codes/icd10?q=S23.420A&on=2026-10-15").expect(200)).body as { code: string }[];
    expect(retiredNow.map((c) => c.code)).not.toContain("S23.420A");
    const retiredThen = (await biller.get("/api/codes/icd10?q=S23.420A&on=2026-05-01").expect(200)).body as { code: string }[];
    expect(retiredThen.map((c) => c.code)).toContain("S23.420A");
  });

  it("refuses charges with a code that isn't billable on the date of service", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const line = { hcpcsCode: "E0218", modifiers: ["NU"], description: "COLD THERAPY", diagnosisPointers: "A", quantity: 1, unitPriceCents: 10000 };
    const enc = (dx: string[]) => ({ serviceDateFrom: "2026-10-15", serviceDateTo: "2026-10-15", insuranceRank: 1, diagnosisCodes: dx, lines: [line] });
    const bad = await biller.post("/api/patients/1/encounters").send(enc(["QA0"])).expect(400);
    expect(bad.body.message).toMatch(/QA0 is a category/);
    await biller.post("/api/patients/1/encounters").send(enc(["S83.511A"])).expect(201);
  });

  it("only settings managers see the load history and can start an update", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller.get("/api/settings/code-sets").expect(403);
    await biller.post("/api/settings/code-sets/update").expect(403);
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    expect((await owner.get("/api/settings/code-sets").expect(200)).body.loads).toHaveLength(3);
  });

  it("official codes can't be edited by hand", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const [e0218] = (await owner.get("/api/settings/codes/hcpcs?q=E0218").expect(200)).body as { id: number; code: string }[];
    expect(e0218.code).toBe("E0218");
    const r = await owner.patch(`/api/settings/codes/hcpcs/${e0218.id}`).send({ effectiveTo: "2026-01-01" }).expect(400);
    expect(r.body.message).toMatch(/can't be changed by hand/);
  });
});
