// Local demo data. FAKE ONLY: no real patients, staff, payers or IDs. (CLAUDE.md 3.2)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getControlDb } from "./db/control";
import { getTenant, type Tenant } from "./db/tenantDb";
import { clients, hcpcsCodes, icd10Codes, modifiers, payers, userClientAssignments, users } from "@shared/schema/control";
import { encounters, ledgerEntries, notes, alerts, patientInsurances, patients, serviceLines } from "@shared/schema/tenant";
import { encryptField, last4 } from "./lib/crypto";
import { DATA_DIR, IN_MEMORY } from "./config";
import { todayIso } from "@shared/dates";

const STARTER = "STARTER LIST (unverified): replace by running the official CMS import";

// A few real HCPCS codes common in DME so the screens can be tried out.
// Descriptions are paraphrased and NOT verified: load the official CMS file before real use.
export const STARTER_HCPCS: [string, string][] = [
  ["E0217", "Water circulating heat pad with pump"],
  ["E0218", "Water circulating cold pad with pump"],
  ["E0236", "Pump for water circulating pad"],
  ["E0650", "Pneumatic compressor, non-segmental home model"],
  ["E0651", "Pneumatic compressor, segmental home model without calibrated gradient pressure"],
  ["E0666", "Non-segmental pneumatic appliance for use with pneumatic compressor, half leg"],
  ["E0676", "Intermittent limb compression device, not otherwise specified"],
  ["E0730", "Transcutaneous electrical nerve stimulation (TENS) device, four or more leads"],
  ["E0745", "Neuromuscular stimulator, electronic shock unit"],
  ["E1399", "Durable medical equipment, miscellaneous"],
];

export const STARTER_ICD10: [string, string][] = [
  ["M25.561", "Pain in right knee"],
  ["M25.562", "Pain in left knee"],
  ["M54.50", "Low back pain, unspecified"],
  ["S83.511A", "Sprain of anterior cruciate ligament of right knee, initial encounter"],
  ["S83.512A", "Sprain of anterior cruciate ligament of left knee, initial encounter"],
  ["S93.401A", "Sprain of unspecified ligament of right ankle, initial encounter"],
  ["S43.401A", "Unspecified sprain of right shoulder joint, initial encounter"],
  ["Z96.651", "Presence of right artificial knee joint"],
];

// The 14 modifiers in the old system's modifier list (screen spec, DATA MENU).
export const STARTER_MODIFIERS: [string, string][] = [
  ["59", "Distinct procedural service"],
  ["CG", "Policy criteria applied"],
  ["GA", "Waiver of liability statement issued as required by payer policy"],
  ["GP", "Services delivered under an outpatient physical therapy plan of care"],
  ["GZ", "Item or service expected to be denied as not reasonable and necessary"],
  ["KF", "Item designated by FDA as class III device"],
  ["KH", "DMEPOS item, initial claim, purchase or first month rental"],
  ["KR", "Rental item, billing for partial month"],
  ["KX", "Requirements specified in the medical policy have been met"],
  ["LT", "Left side"],
  ["NU", "New equipment"],
  ["RR", "Rental"],
  ["RT", "Right side"],
  ["UE", "Used durable medical equipment"],
];

const DEMO_CLIENTS = [
  { slug: "score-demo", name: "SCORE (DEMO)" },
  { slug: "pacific-demo", name: "Pacific Ortho Supply (DEMO)" },
  { slug: "lonestar-demo", name: "Lone Star DME (DEMO)" },
];

const DEMO_USERS = [
  { email: "owner@caliber.test", name: "Demo Owner", initials: "OWN", role: "owner", clients: ["score-demo", "pacific-demo", "lonestar-demo"] },
  { email: "manager@caliber.test", name: "Demo Billing Manager", initials: "BMG", role: "billing_manager", clients: ["score-demo", "pacific-demo"] },
  { email: "biller@caliber.test", name: "Demo Biller", initials: "BIL", role: "biller", clients: ["score-demo"] },
  { email: "poster@caliber.test", name: "Demo Payment Poster", initials: "PAY", role: "payment_poster", clients: ["score-demo"] },
  { email: "auditor@caliber.test", name: "Demo Auditor", initials: "AUD", role: "auditor", clients: ["score-demo"] },
];

function randomPassword() {
  return `Demo-${crypto.randomBytes(6).toString("base64url")}`;
}

/** Seeds the control database and demo clients once. Returns the new logins, or null if already seeded. */
export async function seedDemo(opts: { passwords?: Record<string, string> } = {}) {
  const db = getControlDb();
  const existing = await db.select().from(clients);
  if (existing.length) {
    for (const c of existing) await getTenant(c.id, c.slug); // make sure every client DB is migrated
    return null;
  }

  await db.insert(modifiers).values(STARTER_MODIFIERS.map(([code, description]) => ({ code, description, source: STARTER })));
  await db.insert(hcpcsCodes).values(STARTER_HCPCS.map(([code, shortDescription]) => ({ code, shortDescription, source: STARTER })));
  await db.insert(icd10Codes).values(STARTER_ICD10.map(([code, description]) => ({ code, description, source: STARTER })));
  await db.insert(payers).values([
    { name: "GOLDEN STATE COMP MUTUAL (TEST)", payerType: "WC", state: "CA", city: "Sacramento", phone: "555-0100", notes: "Fake payer for demos" },
    { name: "SUNBELT WC ADMINISTRATORS (TEST)", payerType: "WC", state: "TX", city: "Austin", phone: "555-0101", notes: "Fake payer for demos" },
    { name: "VA MEDICAL CENTER - DIRECT (TEST)", payerType: "VA_DIRECT", state: "CA", city: "San Diego", phone: "555-0102", notes: "Fake payer for demos" },
    { name: "COMMUNITY CARE TPA (TEST)", payerType: "VA_CCN", city: "Phoenix", state: "AZ", phone: "555-0103", notes: "Fake payer for demos" },
  ]);

  const clientRows = await db.insert(clients).values(DEMO_CLIENTS).returning();
  const logins: { role: string; email: string; password: string }[] = [];
  for (const u of DEMO_USERS) {
    const password = opts.passwords?.[u.email] ?? randomPassword();
    const [row] = await db
      .insert(users)
      .values({ email: u.email, name: u.name, initials: u.initials, role: u.role, userType: "staff", passwordHash: await bcrypt.hash(password, 10) })
      .returning();
    for (const slug of u.clients) {
      const c = clientRows.find((x) => x.slug === slug)!;
      await db.insert(userClientAssignments).values({ userId: row.id, clientId: c.id });
    }
    logins.push({ role: u.role, email: u.email, password });
  }

  const payerRows = await db.select().from(payers);
  for (const [i, c] of clientRows.entries()) {
    const tenant = await getTenant(c.id, c.slug);
    await seedClientPatients(tenant, c.name, i, payerRows);
  }

  if (!IN_MEMORY) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const lines = ["Caliber DME Billing: local demo logins (fake data only)", "", ...logins.map((l) => `${l.role.padEnd(20)} ${l.email.padEnd(28)} ${l.password}`), ""];
    fs.writeFileSync(path.join(DATA_DIR, "DEMO_LOGINS.txt"), lines.join("\n"), { mode: 0o600 });
  }
  return logins;
}

type PayerRow = typeof payers.$inferSelect;

async function seedClientPatients(tenant: Tenant, clientName: string, index: number, payerRows: PayerRow[]) {
  const db = tenant.db;
  const tag = clientName.split(" ")[0].replace(/[^A-Z]/gi, "").toUpperCase();
  const wc = payerRows.find((p) => p.payerType === "WC")!;
  const va = payerRows.find((p) => p.payerType === "VA_CCN")!;
  const people = [
    { last: `TEST-${tag}`, first: "PATIENT ONE", dob: "1980-01-01", sex: "M", coverage: "WC", payer: wc, ssn: `00000000${index + 1}` },
    { last: `TEST-${tag}`, first: "PATIENT TWO", dob: "1975-06-15", sex: "F", coverage: "VA_CCN", payer: va, ssn: `00000001${index + 1}` },
  ];
  for (const [n, person] of people.entries()) {
    const [p] = await db
      .insert(patients)
      .values({
        accountNumber: String(100001 + n),
        lastName: person.last,
        firstName: person.first,
        dob: person.dob,
        sex: person.sex,
        address1: "123 TEST STREET",
        city: "SAN DIEGO",
        state: "CA",
        zip: "92101",
        phone: "555-0199",
        coverageType: person.coverage,
        ssnEncrypted: encryptField(tenant.key, person.ssn),
        ssnLast4: last4(person.ssn),
        createdBy: "SYS",
      })
      .returning();
    await db.insert(patientInsurances).values({
      patientId: p.id,
      rank: 1,
      payerId: person.payer.id,
      payerName: person.payer.name,
      payerType: person.payer.payerType,
      relationshipToInsured: "18",
      subscriberLastName: person.last,
      subscriberFirstName: person.first,
      subscriberDob: person.dob,
      subscriberSex: person.sex,
      memberIdEncrypted: encryptField(tenant.key, `TESTMEMBER${n}${index}`),
      memberIdLast4: last4(`TESTMEMBER${n}${index}`),
      claimNumber: person.coverage === "WC" ? `TEST-CLM-${index}${n}` : null,
      dateOfInjury: person.coverage === "WC" ? "2026-08-01" : null,
      employerName: person.coverage === "WC" ? "TEST EMPLOYER INC" : null,
      adjusterName: person.coverage === "WC" ? "TEST ADJUSTER" : null,
      referralNumber: person.coverage === "VA_CCN" ? `TEST-REF-${index}${n}` : null,
    });

    if (n === 0) {
      // One worked example so the ledger colors show up.
      const today = todayIso();
      const [e] = await db
        .insert(encounters)
        .values({ patientId: p.id, serviceDateFrom: "2026-09-01", serviceDateTo: "2026-09-30", diagnosisCodes: ["S83.511A", "M25.561"], createdBy: "SYS" })
        .returning();
      const lines = [
        { hcpcsCode: "E0666", modifiers: ["NU"], description: "Non-segmental pneumatic appliance, half leg", diagnosisPointers: "AB", quantity: 1, unitPriceCents: 25000 },
        { hcpcsCode: "E0650", modifiers: ["RR"], description: "Pneumatic compressor, non-segmental home model", diagnosisPointers: "A", quantity: 30, unitPriceCents: 10500 },
      ];
      for (const [i, l] of lines.entries()) {
        const chargeCents = l.unitPriceCents * l.quantity;
        const [sl] = await db.insert(serviceLines).values({ ...l, encounterId: e.id, lineNumber: i + 1, chargeCents }).returning();
        await db.insert(ledgerEntries).values({
          patientId: p.id, kind: "charge", postDate: today, serviceDateFrom: "2026-09-01", serviceDateTo: "2026-09-30",
          serviceLineId: sl.id, encounterId: e.id, code: [l.hcpcsCode, ...l.modifiers].join(" "), description: l.description,
          quantity: l.quantity, insuranceDeltaCents: chargeCents, patientDeltaCents: 0, payerName: person.payer.name, createdBy: "SYS",
        });
      }
      await db.insert(ledgerEntries).values([
        { patientId: p.id, kind: "payment", postDate: today, depositDate: today, encounterId: e.id, description: "PAYMENT CHECK #TEST1001", insuranceDeltaCents: -200000, patientDeltaCents: 0, payerName: person.payer.name, paymentType: "CHECK", checkNumber: "TEST1001", createdBy: "SYS" },
        { patientId: p.id, kind: "writeoff", postDate: today, depositDate: today, encounterId: e.id, reasonCode: "5", description: "WORKERS COMP WRITEOFF", insuranceDeltaCents: -50000, patientDeltaCents: 0, payerName: person.payer.name, createdBy: "SYS" },
      ]);
      await db.insert(notes).values({ patientId: p.id, body: "Demo note: called adjuster to confirm authorization. (Fake data.)", createdBy: "SYS" });
      await db.insert(alerts).values({ patientId: p.id, body: "Demo alert: authorization expires soon. (Fake data.)", createdBy: "SYS" });
    }
  }
}
