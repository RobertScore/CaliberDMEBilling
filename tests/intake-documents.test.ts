// Intake (paperwork in → read → match → file) and documents, including client separation.
import { setup, login } from "./helpers";
import { makePdf } from "../server/lib/demoPaperwork";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const pdf = () => makePdf([[{ x: 50, y: 700, size: 12, text: `Fake test page ${Math.random()}` }]]);

async function openItems(agent: Awaited<ReturnType<typeof login>>) {
  return (await agent.get("/api/intake").expect(200)).body as { id: number; source: string; status: string; foundName: string | null }[];
}

describe("intake inbox", () => {
  it("starts with demo paperwork that the demo reader has read", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const items = await openItems(biller);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const fax = items.find((i) => i.source === "fax")!;
    const detail = (await biller.get(`/api/intake/${fax.id}`).expect(200)).body;
    expect(detail.reader).toBe("demo");
    expect(detail.extraction.patient.lastName.value).toBe("SAMPLE");
    expect(detail.documents[0].docType).toBe("rx");
  });

  it("files a new patient from paperwork, with the documents typed and verified", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const fax = (await openItems(biller)).find((i) => i.source === "fax")!;
    const detail = (await biller.get(`/api/intake/${fax.id}`).expect(200)).body;
    expect(detail.matches.filter((m: { score: number }) => m.score >= 80)).toHaveLength(0);
    const r = await biller
      .post(`/api/intake/${fax.id}/complete`)
      .send({
        decision: "new",
        patient: { lastName: "SAMPLE", firstName: "MARIA", dob: "1979-04-22", sex: "F", coverageType: "WC", insurances: [{ rank: 1, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-WC-7781" }] },
        documents: [{ id: detail.documents[0].id, docType: "rx", verified: true }],
      })
      .expect(200);
    const docs = (await biller.get(`/api/patients/${r.body.patientId}/documents`).expect(200)).body;
    expect(docs.documents).toHaveLength(1);
    const rx = docs.checklist.items.find((i: { docType: string }) => i.docType === "rx");
    expect(rx.status).toBe("verified");
    expect(docs.checklist.items.find((i: { docType: string }) => i.docType === "delivery_ticket").status).toBe("missing");
    // Done items leave the open inbox, and can't be filed twice.
    expect((await openItems(biller)).some((i) => i.id === fax.id)).toBe(false);
    await biller.post(`/api/intake/${fax.id}/complete`).send({ decision: "new", documents: [{ id: detail.documents[0].id, docType: "rx", verified: true }] }).expect(409);
    const file = await biller.get(`/api/documents/${detail.documents[0].id}/file`).expect(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("spots an existing patient and refuses to create a duplicate by accident", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const email = (await openItems(biller)).find((i) => i.source === "email")!;
    const detail = (await biller.get(`/api/intake/${email.id}`).expect(200)).body;
    expect(detail.matches[0].score).toBeGreaterThanOrEqual(80);
    expect(detail.matches[0].lastName).toBe("TEST-SCORE");
    const dup = { lastName: "TEST-SCORE", firstName: "PATIENT ONE", dob: "1980-01-01", sex: "M", coverageType: "WC", insurances: [] };
    await biller.post(`/api/intake/${email.id}/complete`).send({ decision: "new", patient: dup, documents: [{ id: detail.documents[0].id, docType: "delivery_ticket", verified: true }] }).expect(409);
    const r = await biller
      .post(`/api/intake/${email.id}/complete`)
      .send({ decision: "existing", patientId: detail.matches[0].patientId, documents: [{ id: detail.documents[0].id, docType: "delivery_ticket", verified: true }] })
      .expect(200);
    expect(r.body.patientId).toBe(detail.matches[0].patientId);
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].category).toBe("intake");
  });

  it("keeps each client's inbox and documents separate", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.pacific);
    const before = (await openItems(owner)).length;
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    const up = await owner.post("/api/intake").field("source", "upload").field("sender", "test").attach("files", pdf(), { filename: "a.pdf", contentType: "application/pdf" }).expect(201);
    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    expect((await openItems(owner)).length).toBe(before);
    const other = await owner.get(`/api/intake/${up.body.id}`);
    if (other.status === 200) expect(other.body.sender).not.toBe("test");
    else expect(other.status).toBe(404);
  });

  it("rejects file types that aren't documents", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    await owner.post("/api/intake").attach("files", Buffer.from("echo hi"), { filename: "x.sh", contentType: "application/x-sh" }).expect(400);
  });

  it("only people with intake permission can use the inbox", async () => {
    const poster = await login(ctx.app, "poster@caliber.test", ctx.score);
    await poster.get("/api/intake").expect(403);
  });
});

describe("notes, follow-ups and templates", () => {
  it("a note with a follow-up date lands on the Call List", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    await biller.post("/api/patients/1/notes").send({ body: "Call adjuster back", category: "call", followUpDate: "2026-01-02" }).expect(201);
    const tasks = (await biller.get("/api/tasks").expect(200)).body;
    expect(tasks.some((t: { title: string; overdue: boolean }) => t.title === "Call adjuster back" && t.overdue)).toBe(true);
    await biller.post("/api/patients/1/notes").send({ body: "x", category: "not-a-category" }).expect(400);
    const templates = (await biller.get("/api/note-templates").expect(200)).body;
    expect(templates.length).toBeGreaterThan(0);
  });

  it("the overview pulls everything for a patient into one response", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const o = (await biller.get("/api/patients/1/overview").expect(200)).body;
    expect(o.patient.insurances.length).toBeGreaterThan(0);
    expect(o.timeline.length).toBeGreaterThan(0);
    expect(o.checklist.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(o)).not.toMatch(/ssnEncrypted|memberIdEncrypted|storageKey/);
  });
});
