// Splitting a packet into separate documents, and choosing where each insurance / claim goes for an existing patient.
import { setup, login } from "./helpers";
import { makePdf } from "../server/lib/demoPaperwork";
import { pdfPageCount } from "../server/lib/pdfPages";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

const packet = (pages: number) => makePdf(Array.from({ length: pages }, (_, i) => [{ x: 50, y: 700, size: 12, text: `Fake packet page ${i + 1} ${Math.random()}` }]));

async function uploadPacket(agent: Awaited<ReturnType<typeof login>>, pages: number) {
  const up = await agent.post("/api/intake").field("source", "fax").attach("files", packet(pages), { filename: "packet.pdf", contentType: "application/pdf" }).expect(201);
  // The reader runs in the background; wait until the item is ready for review.
  for (let i = 0; i < 50; i++) {
    const d = (await agent.get(`/api/intake/${up.body.id}`).expect(200)).body;
    if (d.status === "review") return d;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("reader never finished");
}

const newPatient = (last: string) => ({ lastName: last, firstName: "PACKET", dob: "1990-01-01", sex: "F", coverageType: "WC", insurances: [] });

describe("splitting a packet into documents", () => {
  it("files each part as its own document and keeps set-aside pages off the patient's file", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 5);
    const doc = item.documents[0];
    expect(doc.pageCount).toBe(5);
    const r = await biller
      .post(`/api/intake/${item.id}/complete`)
      .send({
        decision: "new",
        patient: newPatient("TEST-SPLIT"),
        documents: [{ id: doc.id, docType: "other", verified: false, sections: [
          { fromPage: 1, toPage: 1, docType: "other", verified: false, skip: true }, // fax cover
          { fromPage: 2, toPage: 3, docType: "rx", verified: true },
          { fromPage: 4, toPage: 4, docType: "other", verified: false, skip: true }, // someone else's page
          { fromPage: 5, toPage: 5, docType: "delivery_ticket", verified: false },
        ] }],
      })
      .expect(200);
    expect(r.body).toMatchObject({ filed: 2, setAside: 2 });

    const docs = (await biller.get(`/api/patients/${r.body.patientId}/documents`).expect(200)).body;
    expect(docs.documents.map((d: { docType: string }) => d.docType).sort()).toEqual(["delivery_ticket", "rx"]);
    const rx = docs.documents.find((d: { docType: string }) => d.docType === "rx");
    expect(rx).toMatchObject({ pageFrom: 2, pageTo: 3, pageCount: 2, parentDocumentId: doc.id });
    expect(rx.verifiedAt).toBeTruthy();
    const file = await biller.get(`/api/documents/${rx.id}/file`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); }).expect(200);
    expect(await pdfPageCount(file.body as Buffer)).toBe(2);
    expect(docs.checklist.items.find((i: { docType: string }) => i.docType === "rx").status).toBe("verified");

    // The whole packet stays with the inbox item, marked as the packet, and is not on the patient's file.
    const after = (await biller.get(`/api/intake/${item.id}`).expect(200)).body;
    expect(after.documents.find((d: { id: number }) => d.id === doc.id)).toMatchObject({ docType: "packet", patientId: null });
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].body).toMatch(/Set aside.*page 1.*page 4/);
  });

  it("refuses parts that overlap or go past the last page", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 3);
    const send = (sections: object[]) => biller.post(`/api/intake/${item.id}/complete`).send({ decision: "new", patient: newPatient("TEST-BADSPLIT"), documents: [{ id: item.documents[0].id, docType: "other", verified: false, sections }] });
    await send([{ fromPage: 1, toPage: 2, docType: "rx", verified: false }, { fromPage: 2, toPage: 3, docType: "po", verified: false }]).expect(400);
    await send([{ fromPage: 1, toPage: 4, docType: "rx", verified: false }]).expect(400);
    await send([{ fromPage: 3, toPage: 1, docType: "rx", verified: false }]).expect(400);
    // Nothing was filed.
    expect((await biller.get(`/api/intake/${item.id}`).expect(200)).body.status).toBe("review");
  });

  it("can't file another client's packet", async () => {
    const owner = await login(ctx.app, "owner@caliber.test", ctx.score);
    const item = await uploadPacket(owner, 2);
    await owner.post("/api/session/client").send({ clientId: ctx.pacific }).expect(200);
    await owner
      .post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-XCLIENT"), documents: [{ id: item.documents[0].id, docType: "rx", verified: false, sections: [{ fromPage: 1, toPage: 2, docType: "rx", verified: false }] }] })
      .expect((res) => expect([400, 404, 409]).toContain(res.status));
    await owner.post("/api/session/client").send({ clientId: ctx.score }).expect(200);
    expect((await owner.get(`/api/intake/${item.id}`).expect(200)).body.status).toBe("review");
  });
});

describe("finding a patient by name", () => {
  it("matches the last name, the first name, or 'first last'", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    for (const q of ["TEST-SCORE", "PATIENT ONE", "PATIENT ONE TEST-SCORE", "TEST-SCORE, PATIENT"]) {
      const found = (await biller.get(`/api/patients?q=${encodeURIComponent(q)}`).expect(200)).body as { firstName: string }[];
      expect(found.some((p) => p.firstName === "PATIENT ONE")).toBe(true);
    }
  });
});

describe("insurance slots when filing to an existing patient", () => {
  async function fileTo(agent: Awaited<ReturnType<typeof login>>, patientId: number, patient: object, replaceRanks: number[] = []) {
    const item = await uploadPacket(agent, 1);
    await agent.post(`/api/intake/${item.id}/complete`).send({ decision: "existing", patientId, patient, replaceRanks, documents: [{ id: item.documents[0].id, docType: "other", verified: false }] }).expect(200);
    return (await agent.get(`/api/patients/${patientId}`).expect(200)).body as { lastName: string; insurances: { rank: number; claimNumber: string | null; adjusterName: string | null; authorizationNumber: string | null }[] };
  }

  it("adds a second claim without touching the first, and without changing the patient's details", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const before = (await biller.get("/api/patients/1").expect(200)).body;
    const claim1 = before.insurances.find((i: { rank: number }) => i.rank === 1);
    const after = await fileTo(biller, 1, { lastName: "SHOULD-NOT-CHANGE", insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER" }] });
    expect(after.lastName).toBe(before.lastName); // applyUpdates was off
    expect(after.insurances.find((i) => i.rank === 1)).toMatchObject({ claimNumber: claim1.claimNumber, adjusterName: claim1.adjusterName });
    expect(after.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER" });
  });

  it("updating a slot keeps what's on file; replacing a slot starts it fresh", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const updated = await fileTo(biller, 1, { insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", authorizationNumber: "TEST-NEW-AUTH" }] });
    expect(updated.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-SECOND-CLAIM", adjusterName: "NEW ADJUSTER", authorizationNumber: "TEST-NEW-AUTH" });
    const replaced = await fileTo(biller, 1, { insurances: [{ rank: 2, payerId: 1, relationshipToInsured: "18", claimNumber: "TEST-OTHER-CLAIM" }] }, [2]);
    expect(replaced.insurances.find((i) => i.rank === 2)).toMatchObject({ claimNumber: "TEST-OTHER-CLAIM", adjusterName: null, authorizationNumber: null });
  });
});

describe("checking what the AI read", () => {
  it("the demo reader says where on the page each value came from", async () => {
    const { demoPacket, demoExtraction } = await import("../server/lib/demoPaperwork");
    const { sha256 } = await import("../server/lib/fileStore");
    const p = demoPacket("new", "TEST");
    const e = demoExtraction([sha256(p.pdf)])!;
    const last = e.patient.lastName;
    expect(last.value).toBeTruthy();
    expect(last.where).toMatchObject({ file: 0 });
    expect(last.where!.page).toBeGreaterThanOrEqual(1);
    const b = last.where!.box!;
    for (const v of [b.x, b.y, b.w, b.h]) expect(v >= 0 && v <= 1).toBe(true);
  });

  it("stores how each AI field ended up and notes the counts (not the values) on the account", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 1);
    const fieldReview = [
      { field: "lastName", label: "Last name", aiValue: "TEST-REVIEW", finalValue: "TEST-REVIEW", confidence: "high", outcome: "checked" },
      { field: "firstName", label: "First name", aiValue: "PACKIT", finalValue: "PACKET", confidence: "low", outcome: "edited" },
      { field: "phone", label: "Phone", aiValue: "5550000001", finalValue: "5550000001", confidence: "medium", outcome: "ai" },
    ];
    const r = await biller.post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-REVIEW"), documents: [{ id: item.documents[0].id, docType: "other", verified: false }], fieldReview })
      .expect(200);
    const notes = (await biller.get(`/api/patients/${r.body.patientId}/notes`).expect(200)).body;
    expect(notes[0].body).toContain("AI read 3 fields: 1 checked as right, 1 corrected, 1 not checked.");
    expect(notes[0].body).not.toContain("PACKIT");
    const { getTenant } = await import("../server/db/tenantDb");
    const tenant = (await getTenant(ctx.score, "score-demo")).db;
    const { intakeItems } = await import("../shared/schema/tenant");
    const { eq } = await import("drizzle-orm");
    const [row] = await tenant.select().from(intakeItems).where(eq(intakeItems.id, item.id));
    expect(row.fieldReview).toEqual(fieldReview);
  });

  it("rejects a review with an unknown outcome", async () => {
    const biller = await login(ctx.app, "biller@caliber.test", ctx.score);
    const item = await uploadPacket(biller, 1);
    await biller.post(`/api/intake/${item.id}/complete`)
      .send({ decision: "new", patient: newPatient("TEST-BADREVIEW"), documents: [{ id: item.documents[0].id, docType: "other", verified: false }], fieldReview: [{ field: "x", label: "X", aiValue: null, finalValue: null, confidence: "high", outcome: "guessed" }] })
      .expect(400);
  });
});
