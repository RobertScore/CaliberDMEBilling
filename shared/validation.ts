// Input rules shared by the screens and the server. The server ALWAYS re-checks these.
// Field lengths follow the spec's "NUMBER OF CHARACTERS" column where it was readable.
import { z } from "zod";
import { isValidIsoDate } from "./dates";

const isoDate = z.string().refine(isValidIsoDate, "Must be a valid date");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const insuranceInput = z
  .object({
    rank: z.number().int().min(1).max(3),
    payerId: z.number().int().positive(),
    claimNumber: optText(30),
    copayCents: z.number().int().min(0).optional(),
    deductibleCents: z.number().int().min(0).optional(),
    eligibleFrom: isoDate.optional(),
    eligibleTo: isoDate.optional(),
    relationshipToInsured: z.string().min(2).max(2),
    subscriberLastName: optText(50),
    subscriberFirstName: optText(50),
    subscriberDob: isoDate.optional(),
    subscriberSex: z.enum(["F", "M", "U"]).optional(),
    memberId: optText(30), // plain text in, encrypted before saving
    groupNumber: optText(30),
    groupName: optText(60),
    dateOfInjury: isoDate.optional(),
    employerName: optText(60),
    adjusterName: optText(60),
    adjusterPhone: optText(20),
    referralNumber: optText(30),
    authorizationNumber: optText(30),
  })
  .strict();
export type InsuranceInput = z.infer<typeof insuranceInput>;

export const patientInput = z
  .object({
    repInitials: optText(5),
    ssn: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, "") : undefined))
      .refine((v) => v === undefined || v.length === 9, "SSN must be 9 digits"),
    alias: optText(20),
    lastName: z.string().trim().min(1).max(50),
    firstName: z.string().trim().min(1).max(50),
    middleInitial: optText(1),
    title: optText(5),
    dob: isoDate,
    sex: z.enum(["F", "M", "U"]),
    maritalStatus: optText(12),
    address1: optText(80),
    address2: optText(80),
    zip: optText(10),
    city: optText(40),
    state: optText(2),
    country: optText(20),
    phone: optText(20),
    cellPhone: optText(20),
    email: z.union([z.literal(""), z.email().max(80)]).optional().transform((v) => (v === "" ? undefined : v)),
    employer: optText(60),
    occupation: optText(40),
    language: optText(20),
    deceased: z.boolean().default(false),
    respRelationship: optText(20),
    respLastName: optText(50),
    respFirstName: optText(50),
    respPhone: optText(20),
    relativeName: optText(60),
    relativeRelationship: optText(20),
    relativePhone: optText(20),
    referringPhysician: optText(60),
    legacyId: optText(20),
    coverageType: z.enum(["WC", "VA_DIRECT", "VA_CCN", "MEDICARE", "MEDICAID", "COMMERCIAL", "SELF_PAY"]),
    insurances: z.array(insuranceInput).max(3).default([]),
  })
  .strict();
export type PatientInput = z.infer<typeof patientInput>;

export const serviceLineInput = z
  .object({
    hcpcsCode: z.string().trim().toUpperCase().regex(/^[A-Z][0-9]{4}$/, "HCPCS codes look like E0218"),
    modifiers: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}$/)).max(4),
    description: z.string().trim().min(1).max(120),
    diagnosisPointers: z.string().trim().toUpperCase().regex(/^[A-L]{1,4}$/, "Use letters A-L, up to 4"),
    quantity: z.number().int().min(1).max(999),
    unitPriceCents: z.number().int().min(0),
  })
  .strict();

export const encounterInput = z
  .object({
    serviceDateFrom: isoDate,
    serviceDateTo: isoDate,
    renderingProvider: optText(60),
    billingProvider: optText(60),
    facility: optText(60),
    orderingDoctor: optText(60),
    priorAuthNumber: optText(30),
    priorAuthExpires: isoDate.optional(),
    // "A-L DX CODES ALLOWED" (spec, CHARGE ENTRY)
    diagnosisCodes: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/)).min(1).max(12),
    insuranceRank: z.number().int().min(1).max(3).default(1),
    lines: z.array(serviceLineInput).min(1).max(20),
  })
  .strict()
  .refine((e) => e.serviceDateTo >= e.serviceDateFrom, { message: "Service 'to' date is before 'from' date", path: ["serviceDateTo"] })
  .refine(
    (e) =>
      e.lines.every((l) =>
        [...l.diagnosisPointers].every((p) => p.charCodeAt(0) - 65 < e.diagnosisCodes.length),
      ),
    { message: "A line points to a diagnosis letter that hasn't been entered", path: ["lines"] },
  );
export type EncounterInput = z.infer<typeof encounterInput>;

/** Bulk payment posting (old "Payments & Writeoffs Posting" front screen). */
export const paymentInput = z
  .object({
    encounterId: z.number().int().positive().optional(),
    serviceDateFrom: isoDate.optional(),
    serviceDateTo: isoDate.optional(),
    depositDate: isoDate,
    payerName: z.string().trim().min(1).max(60),
    payerIsPatient: z.boolean().default(false),
    paymentType: z.string().trim().max(20),
    checkNumber: optText(30),
    claimControlNumber: optText(40),
    batchNumber: optText(20),
    paymentCents: z.number().int().min(0).default(0),
    writeoffCents: z.number().int().min(0).default(0),
    writeoffType: optText(2),
    patShareCents: z.number().int().min(0).default(0),
    patShareType: optText(2),
    statementNote: optText(200),
  })
  .strict()
  .refine((p) => p.paymentCents + p.writeoffCents + p.patShareCents > 0, { message: "Enter a payment, write-off or patient share amount" })
  .refine((p) => p.writeoffCents === 0 || !!p.writeoffType, { message: "Pick a write-off type", path: ["writeoffType"] })
  .refine((p) => p.patShareCents === 0 || !!p.patShareType, { message: "Pick a patient share type", path: ["patShareType"] });
export type PaymentInput = z.infer<typeof paymentInput>;

export const noteInput = z
  .object({
    body: z.string().trim().min(1).max(4000),
    category: z.string().trim().min(1).max(30).default("general"),
    followUpDate: isoDate.optional(),
    assignToUserId: z.number().int().positive().optional(),
  })
  .strict();
export const taskInput = z
  .object({
    patientId: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(200),
    dueDate: isoDate,
    assignToUserId: z.number().int().positive().optional(),
  })
  .strict();
export const alertInput = z.object({ body: z.string().trim().min(1).max(500) }).strict();
export const reverseInput = z.object({ reason: z.string().trim().min(3).max(200) }).strict();
export const periodCloseInput = z.object({ closedThrough: isoDate }).strict();
export const loginInput = z.object({ email: z.string().trim().toLowerCase().max(120), password: z.string().min(1).max(200) }).strict();
export const switchClientInput = z.object({ clientId: z.number().int().positive() }).strict();
