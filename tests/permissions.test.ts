// CLAUDE.md 5: deny by default; every permission is checked on the server.
import { setup, login, newPatient, newEncounter } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const payment = { depositDate: "2026-10-01", payerName: "TEST PAYER", paymentType: "CHECK", paymentCents: 1000 };

describe("permissions", () => {
  it("rejects wrong passwords and requests without a login", async () => {
    const request = (await import("supertest")).default;
    await request(ctx.app).post("/api/auth/login").send({ email: "owner@caliber.test", password: "wrong" }).expect(401);
    await request(ctx.app).get("/api/patients").expect(401);
    await request(ctx.app).get("/api/session").expect(401);
  });

  it("payment poster can post payments but not create patients or charges", async () => {
    const poster = await login(ctx.app, "poster@caliber.test", ctx.score);
    await poster.post("/api/patients").send(newPatient("NOPE")).expect(403);
    await poster.post("/api/patients/1/encounters").send(newEncounter).expect(403);
    await poster.post("/api/patients/1/payments").send(payment).expect(201);
  });

  it("biller can register patients and post charges but not payments, removals or SSN reveals", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const p = (await biller.post("/api/patients").send(newPatient("BILLERMADE")).expect(201)).body;
    await biller.post(`/api/patients/${p.id}/encounters`).send(newEncounter).expect(201);
    await biller.post(`/api/patients/${p.id}/payments`).send(payment).expect(403);
    await biller.delete(`/api/patients/${p.id}`).expect(403);
    await biller.post(`/api/patients/${p.id}/reveal-ssn`).expect(403);
    await biller.get("/api/audit").expect(403);
    await biller.post("/api/periods/close").send({ closedThrough: "2026-01-01" }).expect(403);
  });

  it("auditor can read and see the audit log but not change anything", async () => {
    const auditor = await login(ctx.app, "auditor@caliber.test", ctx.score);
    await auditor.get("/api/patients/1").expect(200);
    await auditor.get("/api/audit").expect(200);
    await auditor.put("/api/patients/1").send(newPatient("CHANGED")).expect(403);
    await auditor.post("/api/patients/1/notes").send({ body: "x" }).expect(403);
  });

  it("SSNs are masked, and a reveal is logged", async () => {
    const manager = await login(ctx.app, "manager@caliber.test", ctx.score);
    const p = (await manager.get("/api/patients/1").expect(200)).body;
    expect(p.ssnMasked).toMatch(/^\*\*\*-\*\*-\d{4}$/);
    expect(JSON.stringify(p)).not.toMatch(/ssnEncrypted|memberIdEncrypted/);
    const r = (await manager.post("/api/patients/1/reveal-ssn").expect(200)).body;
    expect(r.ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    const audit = (await manager.get("/api/audit").expect(200)).body as { action: string; entityType: string }[];
    expect(audit.some((a) => a.action === "reveal" && a.entityType === "patient.ssn")).toBe(true);
  });

  it("only management can remove a patient, and removal hides rather than erases", async () => {
    const manager = await login(ctx.app, "manager@caliber.test", ctx.score);
    const p = (await manager.post("/api/patients").send(newPatient("TOREMOVE")).expect(201)).body;
    await manager.delete(`/api/patients/${p.id}`).expect(200);
    await manager.get(`/api/patients/${p.id}`).expect(404);
    const audit = (await manager.get("/api/audit").expect(200)).body as { action: string; entityId: string }[];
    expect(audit.some((a) => a.action === "remove" && a.entityId === String(p.id))).toBe(true);
  });
});
