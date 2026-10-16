// CLAUDE.md 3.3: whole cents, append-only ledger, reversals, books closed, notes that can't change.
import { sql } from "drizzle-orm";
import { setup, login, newPatient, newEncounter } from "./helpers";
import { getTenant } from "../server/db/tenantDb";
import { todayIso } from "@shared/dates";

let ctx: Awaited<ReturnType<typeof setup>>;

/** Database errors arrive wrapped ("Failed query: ..."); the real reason is in .cause. */
async function dbError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return `${err.message} ${err.cause?.message ?? ""}`;
  }
  return "no error";
}
beforeAll(async () => {
  ctx = await setup();
});

async function freshPatient() {
  const owner = await login(ctx.app, "owner@caliber.test", ctx.lonestar);
  const p = (await owner.post("/api/patients").send(newPatient(`LEDGER${Math.random().toString(36).slice(2, 7).toUpperCase()}`)).expect(201)).body;
  return { owner, id: p.id as number };
}

describe("ledger", () => {
  it("balances come from adding up the entries", async () => {
    const { owner, id } = await freshPatient();
    await owner
      .post(`/api/patients/${id}/encounters`)
      .send({ ...newEncounter, lines: [...newEncounter.lines, { hcpcsCode: "E0650", modifiers: ["RR"], description: "COMPRESSOR", diagnosisPointers: "A", quantity: 3, unitPriceCents: 10501 }] })
      .expect(201);
    let L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.totalBalanceCents).toBe(45000 + 3 * 10501);

    const r = await owner.post(`/api/patients/${id}/payments`).send({
      depositDate: "2026-10-01", payerName: "TEST PAYER", paymentType: "CHECK", checkNumber: "T1",
      paymentCents: 30000, writeoffCents: 10000, writeoffType: "5", patShareCents: 2500, patShareType: "3",
    }).expect(201);
    expect(r.body.entries).toHaveLength(3);
    expect(r.body.warnings.join(" ")).toMatch(/Work Comp/); // ASSUMPTION Q-046 warning

    L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.insuranceBalanceCents).toBe(45000 + 31503 - 30000 - 10000 - 2500);
    expect(L.balances.patientBalanceCents).toBe(2500);
    expect(L.balances.totalBalanceCents).toBe(45000 + 31503 - 30000 - 10000);
  });

  it("patient search and the home dashboard show each patient's true balance", async () => {
    const { owner, id } = await freshPatient();
    await owner.post(`/api/patients/${id}/encounters`).send(newEncounter).expect(201);
    await owner.post(`/api/patients/${id}/payments`).send({ depositDate: "2026-10-01", payerName: "T", paymentType: "CHECK", paymentCents: 12345 }).expect(201);
    const L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.balances.totalBalanceCents).toBe(45000 - 12345);
    const found = (await owner.get(`/api/patients?q=${L.patient.lastName}`).expect(200)).body;
    expect(found[0].balanceCents).toBe(45000 - 12345);
    const dash = (await owner.get("/api/dashboard").expect(200)).body;
    const mine = dash.recent.find((p: { id: number }) => p.id === id);
    expect(mine.balanceCents).toBe(45000 - 12345);
    // A patient with no activity has a zero balance (not someone else's).
    const empty = (await owner.post("/api/patients").send(newPatient("NOACTIVITY")).expect(201)).body;
    const e = (await owner.get(`/api/patients?q=NOACTIVITY`).expect(200)).body.find((p: { id: number }) => p.id === empty.id);
    expect(e.balanceCents).toBe(0);
  });

  it("a reversal undoes an entry without erasing it, and only once", async () => {
    const { owner, id } = await freshPatient();
    await owner.post(`/api/patients/${id}/encounters`).send(newEncounter).expect(201);
    let L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    const charge = L.entries[0];
    await owner.post(`/api/ledger/${charge.id}/reverse`).send({ reason: "posted to wrong patient" }).expect(201);
    await owner.post(`/api/ledger/${charge.id}/reverse`).send({ reason: "again" }).expect(400);
    L = (await owner.get(`/api/patients/${id}/ledger`).expect(200)).body;
    expect(L.entries).toHaveLength(2);
    expect(L.balances.totalBalanceCents).toBe(0);
    expect(L.entries.find((e: { id: number }) => e.id === charge.id).reversed).toBe(true);
  });

  it("the database itself refuses to edit or delete ledger entries, notes and audit records", async () => {
    const { owner, id } = await freshPatient();
    await owner.post(`/api/patients/${id}/encounters`).send(newEncounter).expect(201);
    await owner.post(`/api/patients/${id}/notes`).send({ body: "permanent" }).expect(201);
    const t = await getTenant(ctx.lonestar, "lonestar-demo");
    expect(await dbError(t.db.execute(sql`UPDATE ledger_entries SET insurance_delta_cents = 1`))).toMatch(/never be edited/);
    expect(await dbError(t.db.execute(sql`DELETE FROM ledger_entries`))).toMatch(/never be edited/);
    expect(await dbError(t.db.execute(sql`UPDATE notes SET body = 'changed'`))).toMatch(/never be edited/);
    expect(await dbError(t.db.execute(sql`DELETE FROM audit_log`))).toMatch(/never be edited/);
  });

  it("nothing can be posted into a closed period", async () => {
    const { owner, id } = await freshPatient();
    // The screen only allows closing past dates; here we simulate the books being closed through today.
    const t = await getTenant(ctx.lonestar, "lonestar-demo");
    await owner.post("/api/periods/close").send({ closedThrough: todayIso() }).expect(400);
    await t.db.execute(sql`INSERT INTO period_closes (closed_through, closed_by) VALUES (${todayIso()}, 'TEST')`);
    const res = await owner.post(`/api/patients/${id}/encounters`).send(newEncounter).expect(409);
    expect(res.body.message).toMatch(/closed/i);
    expect(
      await dbError(t.db.execute(sql`INSERT INTO ledger_entries (patient_id, kind, post_date, description, insurance_delta_cents, patient_delta_cents, created_by) VALUES (${id}, 'adjustment', ${todayIso()}, 'x', 1, 0, 'TEST')`)),
    ).toMatch(/Books are closed/);
  });

  it("rejects bad input", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    await owner.post("/api/patients/1/encounters").send({ ...newEncounter, diagnosisCodes: [] }).expect(400);
    await owner.post("/api/patients/1/encounters").send({ ...newEncounter, lines: [{ ...newEncounter.lines[0], diagnosisPointers: "C" }] }).expect(400);
    await owner.post("/api/patients/1/encounters").send({ ...newEncounter, lines: [{ ...newEncounter.lines[0], hcpcsCode: "12345" }] }).expect(400);
    await owner.post("/api/patients/1/payments").send({ depositDate: "2026-10-01", payerName: "X", paymentType: "CHECK", writeoffCents: 100 }).expect(400);
    await owner.post("/api/patients").send(newPatient("BADSSN", { ssn: "123" })).expect(400);
    await owner.post("/api/patients").send(newPatient("BADDATE", { dob: "1990-02-30" })).expect(400);
  });
});
