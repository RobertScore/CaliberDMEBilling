// CLAUDE.md 3.1: one client's data must NEVER reach another client. These tests try to break that.
import fs from "node:fs";
import path from "node:path";
import { setup, login, newPatient, newEncounter } from "./helpers";
import { getTenant } from "../server/db/tenantDb";
import { encryptField, decryptField } from "../server/lib/crypto";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

type P = { id: number; lastName: string };
const FOREIGN_TO_SCORE = ["TEST-PACIFIC", "TEST-LONE"];
/** True when none of these patients belong to another client. */
const onlyScore = (ps: P[]) => ps.length > 0 && ps.every((p) => !FOREIGN_TO_SCORE.some((f) => p.lastName.startsWith(f)));

describe("client separation", () => {
  it("each client only sees its own patients", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const a = (await owner.get("/api/patients").expect(200)).body as P[];
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((p) => p.lastName === "TEST-SCORE")).toBe(true);

    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    const b = (await owner.get("/api/patients").expect(200)).body as P[];
    expect(b.length).toBeGreaterThan(0);
    expect(b.every((p) => p.lastName === "TEST-PACIFIC")).toBe(true);
  });

  it("a patient created in one client never appears in another", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const created = (await owner.post("/api/patients").send(newPatient("ONLYINSCORE")).expect(201)).body;
    await owner.post(`/api/patients/${created.id}/encounters`).send(newEncounter).expect(201);
    await owner.post(`/api/patients/${created.id}/notes`).send({ body: "score-only note" }).expect(201);

    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    expect(((await owner.get("/api/patients?q=ONLYINSCORE").expect(200)).body as P[]).length).toBe(0);
    // The same numeric ID in the other client is a different record (or nothing at all).
    const res = await owner.get(`/api/patients/${created.id}`);
    if (res.status === 200) expect(res.body.lastName).not.toBe("ONLYINSCORE");
    else expect(res.status).toBe(404);
    const notes = await owner.get(`/api/patients/${created.id}/notes`);
    if (notes.status === 200) expect(JSON.stringify(notes.body)).not.toContain("score-only note");
    const ledger = await owner.get(`/api/patients/${created.id}/ledger`);
    if (ledger.status === 200) expect(ledger.body.patient.lastName).not.toBe("ONLYINSCORE");
  });

  it("a user can't switch into a client they aren't assigned to", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score); // biller is only assigned to SCORE
    await biller.post("/api/session/client").send({ clientId: ctx.pacific }).expect(403);
    await biller.post("/api/session/client").send({ clientId: ctx.lonestar }).expect(403);
    const still = (await biller.get("/api/patients").expect(200)).body as P[];
    expect(onlyScore(still)).toBe(true);
  });

  it("the client can't be chosen through the URL, body or headers", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const viaQuery = (await owner.get(`/api/patients?clientId=${ctx.pacific}&client=${ctx.pacific}`).expect(200)).body as P[];
    expect(onlyScore(viaQuery)).toBe(true);
    const viaHeader = (await owner.get("/api/patients").set("X-Client-Id", String(ctx.pacific)).expect(200)).body as P[];
    expect(onlyScore(viaHeader)).toBe(true);
    // Unknown fields in the body are rejected outright.
    await owner.post("/api/patients").send({ ...newPatient("SNEAKY"), clientId: ctx.pacific }).expect(400);
  });

  it("the home dashboard only counts the current client", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.pacific);
    const d = (await owner.get("/api/dashboard").expect(200)).body as { recent: P[]; patientCount: number };
    expect(d.recent.length).toBeGreaterThan(0);
    expect(d.recent.every((p) => p.lastName.startsWith("TEST-PACIFIC"))).toBe(true);
    const pacificCount = d.patientCount;
    await owner.post("/api/session/client").send({ clientId: ctx.lonestar }).expect(200);
    const l = (await owner.get("/api/dashboard").expect(200)).body as { recent: P[]; patientCount: number };
    expect(l.recent.every((p) => !p.lastName.startsWith("TEST-PACIFIC") && !p.lastName.startsWith("TEST-SCORE"))).toBe(true);
    expect(l.patientCount).not.toBeNaN();
    expect(pacificCount).toBeGreaterThan(0);
  });

  it("nothing patient-related works until a client is picked", async () => {
    const owner = await login(ctx.app, "owner@caliber.test");
    await owner.get("/api/patients").expect(409);
    await owner.get("/api/audit").expect(409);
    await owner.get("/api/dashboard").expect(409);
  });

  it("removing a user's assignment cuts access immediately, even mid-session", async () => {
    const { getControlDb } = await import("../server/db/control");
    const { userClientAssignments, users } = await import("@shared/schema/control");
    const { and, eq } = await import("drizzle-orm");
    const manager = await login(ctx.app, "manager@caliber.test", ctx.pacific);
    await manager.get("/api/patients").expect(200);
    const [m] = await getControlDb().select().from(users).where(eq(users.email, "manager@caliber.test"));
    await getControlDb()
      .delete(userClientAssignments)
      .where(and(eq(userClientAssignments.userId, m.id), eq(userClientAssignments.clientId, ctx.pacific)));
    await manager.get("/api/patients").expect(403);
    await getControlDb().insert(userClientAssignments).values({ userId: m.id, clientId: ctx.pacific });
  });

  it("each client's audit log only holds that client's activity", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.lonestar);
    const before = (await owner.get("/api/audit").expect(200)).body.length;
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    await owner.get("/api/patients?q=TEST").expect(200);
    await owner.get("/api/patients/1").expect(200);
    await owner.post("/api/session/client").send({ clientId: ctx.lonestar }).expect(200);
    const after = (await owner.get("/api/audit").expect(200)).body.length;
    expect(after).toBe(before);
  });

  it("each client has its own encryption key", async () => {
    const a = await getTenant(ctx.score, "score-demo");
    const b = await getTenant(ctx.pacific, "pacific-demo");
    expect(a.key.equals(b.key)).toBe(false);
    const secret = encryptField(a.key, "000000001");
    expect(decryptField(a.key, secret)).toBe("000000001");
    expect(() => decryptField(b.key, secret)).toThrow();
  });

  it("only the tenant helper opens databases", () => {
    const root = path.resolve(import.meta.dirname, "..", "server");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.ts$/.test(f.name) && /new PGlite\(|from "pg"|drizzle\(/.test(fs.readFileSync(p, "utf8"))) offenders.push(path.relative(root, p));
      }
    };
    walk(root);
    expect(offenders.sort()).toEqual(["db/control.ts", "db/tenantDb.ts"]);
  });
});
