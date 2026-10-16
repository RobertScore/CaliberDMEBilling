import request from "supertest";
import type { Express } from "express";
import { openControlDb } from "../server/db/control";
import { seedDemo } from "../server/seed";
import { createApp } from "../server/app";
import { getControlDb } from "../server/db/control";
import { clients } from "@shared/schema/control";

export const PW = "Test-Password-1";
export const EMAILS = ["owner@caliber.test", "manager@caliber.test", "biller@caliber.test", "poster@caliber.test", "auditor@caliber.test"];

export async function setup() {
  await openControlDb();
  await seedDemo({ passwords: Object.fromEntries(EMAILS.map((e) => [e, PW])) });
  const app = createApp();
  const rows = await getControlDb().select().from(clients);
  const id = (slug: string) => rows.find((r) => r.slug === slug)!.id;
  return { app, score: id("score-demo"), pacific: id("pacific-demo"), lonestar: id("lonestar-demo") };
}

/** A logged-in browser session (cookies kept between requests). */
export async function login(app: Express, email: string, clientId?: number) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PW }).expect(200);
  if (clientId) await agent.post("/api/session/client").send({ clientId }).expect(200);
  return agent;
}

export const newPatient = (lastName: string, extra: Record<string, unknown> = {}) => ({
  lastName,
  firstName: "SYNTHETIC",
  dob: "1990-02-03",
  sex: "F",
  coverageType: "WC",
  ssn: "000-00-0009",
  insurances: [{ rank: 1, payerId: 1, relationshipToInsured: "18", memberId: "TESTMEMBER77", claimNumber: "TEST-77" }],
  ...extra,
});

export const newEncounter = {
  serviceDateFrom: "2026-09-01",
  serviceDateTo: "2026-09-01",
  diagnosisCodes: ["M25.561"],
  lines: [{ hcpcsCode: "E0218", modifiers: ["NU", "RT"], description: "COLD PAD", diagnosisPointers: "A", quantity: 1, unitPriceCents: 45000 }],
};
