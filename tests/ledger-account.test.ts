// The ledger-first account screen's server side: line item posting, adjustments, refunds and claim status.
import { setup, login, newPatient, newEncounter } from "./helpers";
import { getTenant } from "../server/db/tenantDb";
import { todayIso } from "@shared/dates";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const twoLines = {
  ...newEncounter,
  lines: [...newEncounter.lines, { hcpcsCode: "E0650", modifiers: ["RR"], description: "COMPRESSOR", diagnosisPointers: "A", quantity: 2, unitPriceCents: 10000 }],
};

/** A fresh SCORE (demo) patient with one two-line claim: $450.00 + 2 x $100.00. */
async function patientWithClaim() {
  const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
  const p = (await owner.post("/api/patients").send(newPatient(`ACCT${Math.random().toString(36).slice(2, 7).toUpperCase()}`)).expect(201)).body;
  const enc = (await owner.post(`/api/patients/${p.id}/encounters`).send(twoLines).expect(201)).body;
  return { owner, id: p.id as number, encId: enc.encounter.id as number, lineIds: enc.lines.map((l: { id: number }) => l.id) as number[] };
}

const header = (encounterId: number) => ({ encounterId, depositDate: "2026-10-01", payerName: "TEST PAYER", paymentType: "CHECK", checkNumber: "LI-1" });

describe("line item posting", () => {
  it("posts amounts per line, each tied to its line, and balances still add up from the entries", async () => {
    const { owner, id, encId, lineIds } = await patientWithClaim();
    const r = await owner.post(`/api/patients/${id}/line-payments`).send({
      ...header(encId),
      lines: [
        { serviceLineId: lineIds[0], allowedCents: 30000, paymentCents: 30000, writeoffCents: 15000, writeoffType: "5" },
        { serviceLineId: lineIds[1], allowedCents: 0, writeoffCents: 20000, writeoffType: "E" },
      ],
    }).expect(201);
    expect(r.body.entries).toHaveLength(3);
    const L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.totalBalanceCents).toBe(0);
    const line1 = L.entries.filter((e: { serviceLineId: number }) => e.serviceLineId === lineIds[0]);
    expect(line1.map((e: { kind: string }) => e.kind).sort()).toEqual(["charge", "payment", "writeoff"]);
    expect(line1.find((e: { kind: string }) => e.kind === "payment").allowedCents).toBe(30000);
  });

  it("refuses a line from a different claim, and a line with no amount anywhere", async () => {
    const a = await patientWithClaim();
    const b = await patientWithClaim();
    await a.owner.post(`/api/patients/${a.id}/line-payments`).send({ ...header(a.encId), lines: [{ serviceLineId: b.lineIds[0], paymentCents: 100 }] }).expect(400);
    await a.owner.post(`/api/patients/${a.id}/line-payments`).send({ ...header(a.encId), lines: [{ serviceLineId: a.lineIds[0] }] }).expect(400);
    // Another patient's claim can't be used either.
    await a.owner.post(`/api/patients/${a.id}/line-payments`).send({ ...header(b.encId), lines: [{ serviceLineId: b.lineIds[0], paymentCents: 100 }] }).expect(404);
  });
});

describe("adjustments and refunds", () => {
  it("an adjustment raises or lowers one side; a refund raises it back", async () => {
    const { owner, id, encId } = await patientWithClaim();
    await owner.post(`/api/patients/${id}/payments`).send({ encounterId: encId, depositDate: "2026-10-01", payerName: "TEST PAYER", paymentType: "CHECK", paymentCents: 70000 }).expect(201);
    let L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.totalBalanceCents).toBe(-5000); // overpaid by $50

    await owner.post(`/api/patients/${id}/adjustments`).send({ kind: "refund", encounterId: encId, side: "insurance", amountCents: 5000, reason: "Overpayment returned", paidTo: "TEST PAYER", checkNumber: "R-1" }).expect(201);
    await owner.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "insurance", direction: "decrease", amountCents: 1234, reason: "Small balance adjustment" }).expect(201);
    L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.totalBalanceCents).toBe(-1234);
    const refund = L.entries.find((e: { kind: string }) => e.kind === "refund");
    expect(refund).toMatchObject({ insuranceDeltaCents: 5000, encounterId: encId, payerName: "TEST PAYER" });
  });

  it("a refund can't lower a balance and must say who got the money", async () => {
    const { owner, id } = await patientWithClaim();
    await owner.post(`/api/patients/${id}/adjustments`).send({ kind: "refund", side: "patient", direction: "decrease", amountCents: 100, reason: "Wrong way", paidTo: "X" }).expect(400);
    await owner.post(`/api/patients/${id}/adjustments`).send({ kind: "refund", side: "patient", amountCents: 100, reason: "No payee" }).expect(400);
  });

  it("the books-closed rule applies", async () => {
    const { owner, id } = await patientWithClaim();
    // Close yesterday: today's postings still go through.
    const y = new Date(Date.parse(todayIso()) - 86400000).toISOString().slice(0, 10);
    const periods = (await owner.get("/api/periods").expect(200)).body as { closedThrough: string }[];
    if (!periods.some((p) => p.closedThrough >= y)) await owner.post("/api/periods/close").send({ closedThrough: y }).expect(201);
    await owner.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "patient", amountCents: 100, reason: "Posted in the open period" }).expect(201);
  });
});

describe("claim status", () => {
  it("records how and to whom a claim was sent, keeps the history, and notes the account", async () => {
    const { owner, id, encId } = await patientWithClaim();
    await owner.post(`/api/encounters/${encId}/status`).send({ status: "billed" }).expect(400); // must say how
    await owner.post(`/api/encounters/${encId}/status`).send({ status: "billed", method: "paper" }).expect(201);
    await owner.post(`/api/encounters/${encId}/status`).send({ status: "denied", note: "Needs the signed delivery ticket" }).expect(201);
    const L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.encounters[0].claimStatus).toBe("denied");
    expect(L.claimEvents.map((e: { status: string }) => e.status)).toEqual(["billed", "denied"]);
    expect(L.claimEvents[0]).toMatchObject({ method: "paper", previousStatus: "not_billed" });
    expect(L.claimEvents[0].sentTo).toBeTruthy(); // defaults to the claim's payer
    const notes = (await owner.get(`/api/patients/${id}/notes`).expect(200)).body as { body: string; category: string }[];
    expect(notes.some((n) => n.category === "claim" && /Ready to bill → Billed\. Sent Paper \(CMS-1500\)/.test(n.body))).toBe(true);
  });

  it("claim history can't be edited or deleted, even directly in the database", async () => {
    const { owner, encId } = await patientWithClaim();
    await owner.post(`/api/encounters/${encId}/status`).send({ status: "pending" }).expect(201);
    const t = await getTenant(ctx.score, "score-demo");
    await expect(t.db.execute(`update claim_events set status = 'paid' where encounter_id = ${encId}`)).rejects.toThrow();
    await expect(t.db.execute(`delete from claim_events where encounter_id = ${encId}`)).rejects.toThrow();
  });
});

describe("permissions for the new actions", () => {
  it("a payment poster can post line items and adjustments but not change claim status", async () => {
    const { encId, id, lineIds } = await patientWithClaim();
    const poster = await login(ctx.app, "poster@caliber.test", ctx.score);
    await poster.post(`/api/patients/${id}/line-payments`).send({ ...header(encId), lines: [{ serviceLineId: lineIds[0], paymentCents: 100 }] }).expect(201);
    await poster.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "insurance", direction: "decrease", amountCents: 100, reason: "Test" }).expect(201);
    await poster.post(`/api/encounters/${encId}/status`).send({ status: "pending" }).expect(403);
  });

  it("a biller can change claim status but not post payments, line items or adjustments", async () => {
    const { encId, id, lineIds } = await patientWithClaim();
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller.post(`/api/encounters/${encId}/status`).send({ status: "billed", method: "electronic" }).expect(201);
    await biller.post(`/api/patients/${id}/line-payments`).send({ ...header(encId), lines: [{ serviceLineId: lineIds[0], paymentCents: 100 }] }).expect(403);
    await biller.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "insurance", amountCents: 100, reason: "Test" }).expect(403);
  });

  it("an auditor can read the ledger but change nothing", async () => {
    const { encId, id } = await patientWithClaim();
    const auditor = await login(ctx.app, "auditor@caliber.test", ctx.score);
    await auditor.get(`/api/patients/${id}/ledger`).expect(200);
    await auditor.post(`/api/encounters/${encId}/status`).send({ status: "pending" }).expect(403);
    await auditor.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "insurance", amountCents: 100, reason: "Test" }).expect(403);
  });
});

describe("client separation for the new actions", () => {
  it("logged into another client, none of these can reach this client's patient or claim", async () => {
    const { id, encId, lineIds } = await patientWithClaim(); // SCORE (demo)
    const other = await login(ctx.app, "owner@caliber.test", ctx.pacific);
    await other.post(`/api/encounters/${encId}/status`).send({ status: "paid" }).expect(404);
    await other.post(`/api/patients/${id}/line-payments`).send({ ...header(encId), lines: [{ serviceLineId: lineIds[0], paymentCents: 100 }] }).expect(404);
    await other.post(`/api/patients/${id}/adjustments`).send({ kind: "adjustment", side: "insurance", amountCents: 100, reason: "Cross-client try" }).expect(404);
    // And nothing changed on the real claim.
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.encounters[0].claimStatus).toBe("not_billed");
    expect(L.balances.totalBalanceCents).toBe(65000);
  });
});
