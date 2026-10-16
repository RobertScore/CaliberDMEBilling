// Portals, users & permissions, "View as", API keys, settings and reports.
import request from "supertest";
import { setup, login, PW } from "./helpers";
import { makePdf } from "../server/lib/demoPaperwork";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

describe("client portal", () => {
  it("sees only its own client and can't use staff screens", async () => {
    const portal = await login(ctx.app, "portal@score-demo.test");
    const pts = (await portal.get("/api/portal/client/patients").expect(200)).body as { lastName: string }[];
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.every((p) => !p.lastName.startsWith("TEST-PACIFIC") && !p.lastName.startsWith("TEST-LONE"))).toBe(true);
    await portal.get("/api/patients").expect(403);
    await portal.get("/api/intake").expect(403);
    await portal.post("/api/session/client").send({ clientId: ctx.pacific }).expect(403);
    const detail = (await portal.get(`/api/portal/client/patients/1`).expect(200)).body;
    expect(JSON.stringify(detail)).not.toMatch(/ssn|SSN|memberId/);
  });

  it("uploads go into Caliber's intake inbox for that client", async () => {
    const portal = await login(ctx.app, "portal@score-demo.test");
    await portal.post("/api/portal/client/uploads").field("note", "new order").attach("files", makePdf([[{ x: 50, y: 700, size: 12, text: "x" }]]), { filename: "x.pdf", contentType: "application/pdf" }).expect(201);
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const items = (await owner.get("/api/intake").expect(200)).body as { source: string }[];
    expect(items.some((i) => i.source === "client_portal")).toBe(true);
  });

  it("client reports are limited to that client", async () => {
    const portal = await login(ctx.app, "portal@score-demo.test");
    const aging = (await portal.get("/api/reports/aging").expect(200)).body;
    expect(aging.rows.every((r: { patient: string }) => !r.patient.startsWith("TEST-PACIFIC"))).toBe(true);
  });
});

describe("patient portal", () => {
  it("sees only their own account", async () => {
    const pt = await login(ctx.app, "patient@demo.test");
    const s = (await pt.get("/api/portal/me/summary").expect(200)).body;
    expect(s.lastName).toBe("TEST-SCORE");
    expect(s.firstName).toBe("PATIENT ONE");
    expect(JSON.stringify(s)).not.toMatch(/ssn|SSN/);
    await pt.get("/api/portal/client/patients").expect(403);
    await pt.get("/api/patients/2").expect(403);
    await pt.get("/api/patients/1/notes").expect(403);
    await pt.post("/api/portal/me/messages").send({ body: "Question about my bill" }).expect(201);
  });
});

describe("users, passwords and View as", () => {
  it("a manager can only create lower roles in their own clients, and new users must change their password", async () => {
    const mgr = await login(ctx.app, "manager@caliber.test");
    await mgr.post("/api/admin/users").send({ email: "boss@caliber.test", name: "X", initials: "XX", role: "owner", clientIds: [ctx.score] }).expect(403);
    await mgr.post("/api/admin/users").send({ email: "b2@caliber.test", name: "X", initials: "XX", role: "biller", clientIds: [ctx.lonestar] }).expect(403);
    const r = (await mgr.post("/api/admin/users").send({ email: "newbiller@caliber.test", name: "New Biller", initials: "NB", role: "biller", clientIds: [ctx.score] }).expect(201)).body;
    const agent = request.agent(ctx.app);
    await agent.post("/api/auth/login").send({ email: "newbiller@caliber.test", password: r.temporaryPassword }).expect(200);
    await agent.post("/api/session/client").send({ clientId: ctx.score }).expect(428);
    await agent.post("/api/auth/change-password").send({ currentPassword: r.temporaryPassword, newPassword: "short" }).expect(400);
    await agent.post("/api/auth/change-password").send({ currentPassword: r.temporaryPassword, newPassword: "A-much-better-passw0rd" }).expect(200);
    await agent.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    await agent.get("/api/patients").expect(200);
  });

  it("View as is read-only, logged with both names, and only for people you manage", async () => {
    const mgr = await login(ctx.app, "manager@caliber.test", ctx.score);
    const users = (await mgr.get("/api/admin/users").expect(200)).body.users as { id: number; email: string }[];
    const biller = users.find((u) => u.email === "biller@caliber.test")!;
    expect(users.some((u) => u.email === "owner@caliber.test")).toBe(false);
    await mgr.post("/api/session/view-as").send({ userId: biller.id, reason: "x" }).expect(400);
    await mgr.post("/api/session/view-as").send({ userId: biller.id, reason: "Training check" }).expect(200);
    const s = (await mgr.get("/api/session").expect(200)).body;
    expect(s.user.email).toBe("biller@caliber.test");
    expect(s.viewAs.realName).toBe("Demo Billing Manager");
    await mgr.get("/api/patients/1").expect(200);
    await mgr.post("/api/patients/1/notes").send({ body: "should fail", category: "general" }).expect(403);
    await mgr.delete("/api/session/view-as").expect(200);
    const audit = (await mgr.get("/api/audit").expect(200)).body as { userInitials: string }[];
    expect(audit.some((a) => a.userInitials === "BMG as BIL")).toBe(true);
    const biller2 = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller2.post("/api/session/view-as").send({ userId: 1, reason: "Trying it" }).expect(403);
  });
});

describe("inbound API keys", () => {
  it("a key sends paperwork to its own client only, and revoked keys stop working", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const k = (await owner.post("/api/client-settings/api-keys").send({ name: "Fax gateway" }).expect(201)).body;
    const send = () => request(ctx.app).post("/api/inbound/paperwork").set("Authorization", `Bearer ${k.key}`).field("source", "fax").field("sender", "inbound-test").attach("files", makePdf([[{ x: 50, y: 700, size: 12, text: "x" }]]), { filename: "f.pdf", contentType: "application/pdf" });
    await send().expect(201);
    const inScore = (await owner.get("/api/intake").expect(200)).body as { sender: string }[];
    expect(inScore.some((i) => i.sender === "inbound-test")).toBe(true);
    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    const inPacific = (await owner.get("/api/intake").expect(200)).body as { sender: string }[];
    expect(inPacific.some((i) => i.sender === "inbound-test")).toBe(false);
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    await owner.delete(`/api/client-settings/api-keys/${k.id}`).expect(200);
    await send().expect(401);
    await request(ctx.app).post("/api/inbound/paperwork").set("Authorization", "Bearer nope").expect(401);
  });
});

describe("settings Caliber can customize", () => {
  it("a new write-off reason can be used; a retired one can't", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const item = (await owner.post("/api/settings/lists/writeoff").send({ code: "Q", label: "TEST CONTRACT ADJUSTMENT" }).expect(201)).body;
    const pay = { depositDate: "2026-10-01", payerName: "T", paymentType: "CHECK", writeoffCents: 100, writeoffType: "Q" };
    await owner.post("/api/patients/1/payments").send(pay).expect(201);
    await owner.patch(`/api/settings/lists/items/${item.id}`).send({ active: false }).expect(200);
    await owner.post("/api/patients/1/payments").send(pay).expect(400);
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller.post("/api/settings/lists/writeoff").send({ code: "Z", label: "nope" }).expect(403);
  });

  it("templates and codes can be added", async () => {
    const owner = await login(ctx.app, "owner@caliber.test");
    await owner.post("/api/settings/templates").send({ name: "Test template", category: "general", body: "Hello {{patient}}" }).expect(201);
    await owner.post("/api/settings/codes/hcpcs").send({ code: "L1832", description: "Knee orthosis (test entry)" }).expect(201);
    await owner.post("/api/settings/codes/hcpcs").send({ code: "BAD", description: "x" }).expect(400);
  });
});

describe("reports", () => {
  it("aging matches the ledger and exports to CSV", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.lonestar);
    const aging = (await owner.get("/api/reports/aging").expect(200)).body;
    const ledger = (await owner.get("/api/patients/1/ledger").expect(200)).body;
    const row = aging.rows.find((r: { account: string }) => r.account === ledger.patient.accountNumber);
    expect(row.total).toBe(ledger.balances.totalBalanceCents);
    const csv = await owner.get("/api/reports/aging?format=csv").expect(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.text.split("\n")[0]).toContain("Acct #");
    for (const r of ["daily-activity", "monthly-receivables", "productivity"]) await owner.get(`/api/reports/${r}`).expect(200);
  });
});

export const _pw = PW;
