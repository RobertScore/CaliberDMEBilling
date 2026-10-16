// Document types and what the intake reader returns. Shared by the screens and the server.
import { z } from "zod";

export const DOC_TYPES = [
  { code: "rx", label: "Prescription / order" },
  { code: "delivery_ticket", label: "Delivery ticket / proof of delivery" },
  { code: "po", label: "Purchase order (PO)" },
  { code: "rfa", label: "Request for Authorization (RFA)" },
  { code: "rfs", label: "Request for Service (RFS)" },
  { code: "authorization", label: "Authorization / approval" },
  { code: "chart_notes", label: "Chart notes / medical records" },
  { code: "demographics", label: "Demographics / face sheet" },
  { code: "insurance_card", label: "Insurance card" },
  { code: "referral", label: "VA referral" },
  { code: "eob", label: "EOB / remittance" },
  { code: "other", label: "Other" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["code"];
export const docTypeLabel = (c: string) => DOC_TYPES.find((d) => d.code === c)?.label ?? c;

export const INTAKE_SOURCES = ["upload", "fax", "email", "client_portal", "patient_portal", "api"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/heic", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// ---- What the reader (AI, demo, or a person) produces ----------------------------------
// Every value carries a confidence so the review screen can highlight what needs a closer look.
const conf = z.enum(["high", "medium", "low"]);
const field = z.object({ value: z.string().nullable(), confidence: conf });

export const extractedInsurance = z.object({
  rank: z.number().int().min(1).max(3),
  payerName: field,
  payerTypeGuess: z.enum(["WC", "VA_DIRECT", "VA_CCN", "MEDICARE", "MEDICAID", "COMMERCIAL", "SELF_PAY", "UNKNOWN"]),
  memberId: field,
  groupNumber: field,
  claimNumber: field,
  dateOfInjury: field,
  employerName: field,
  adjusterName: field,
  adjusterPhone: field,
  referralNumber: field,
  authorizationNumber: field,
});

export const extraction = z.object({
  patient: z.object({
    lastName: field,
    firstName: field,
    middleInitial: field,
    dob: field, // YYYY-MM-DD
    sex: field, // F / M / U
    ssn: field,
    address1: field,
    address2: field,
    city: field,
    state: field,
    zip: field,
    phone: field,
    cellPhone: field,
    email: field,
    employer: field,
  }),
  insurances: z.array(extractedInsurance),
  orderingPhysician: field,
  diagnosisCodes: z.array(z.string()),
  hcpcsCodes: z.array(z.string()),
  documents: z.array(z.object({ index: z.number().int(), docType: z.string(), confidence: conf, summary: z.string() })),
  readerNotes: z.string(), // anything the reader couldn't make out, in plain words
});
export type Extraction = z.infer<typeof extraction>;
export type ExtractedField = z.infer<typeof field>;

export const emptyField = (): ExtractedField => ({ value: null, confidence: "low" });
