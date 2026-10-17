// The paperwork reader: turns faxed / emailed / scanned documents into suggested field values.
//
// Modes, picked automatically:
//  - "claude": Claude reads typed text and handwriting. See aiReaderStatus() for when it's on.
//  - "demo": recognizes only the fake sample paperwork from demoPaperwork.ts (used when Claude is off).
//  - "manual": nothing is sent anywhere; staff type the fields while looking at the document.
//
// Whatever the mode, nothing is saved until a person reviews every field.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { extraction, DOC_TYPES, type Extraction } from "@shared/documents";
import { demoExtraction } from "./demoPaperwork";

export type ReaderFile = { data: Buffer; mimeType: string; sha256: string; name: string };
export type ReaderResult = { reader: "claude" | "demo" | "manual"; extraction: Extraction | null; error?: string };

/**
 * Is the Claude reader on?
 *  - CALIBER_AI_READER=off pauses it anywhere (the switch to flip before real patient data, until the BAA is signed).
 *  - Local demo (fake data only): on whenever ANTHROPIC_API_KEY is set. Robert's decision, 2026-10-17.
 *  - Production (real PHI): also needs CALIBER_AI_BAA_CONFIRMED=yes, i.e. a signed BAA with Anthropic (CLAUDE.md 3.2).
 */
export function aiReaderStatus(): { on: boolean; why: string } {
  const production = process.env.NODE_ENV === "production";
  if (process.env.CALIBER_AI_READER === "off") return { on: false, why: "The AI reader is paused." };
  if (!process.env.ANTHROPIC_API_KEY) return { on: false, why: "The AI reader needs an Anthropic API key (see docs/RUNNING_LOCALLY.md)." };
  if (production && process.env.CALIBER_AI_BAA_CONFIRMED !== "yes") return { on: false, why: "The AI reader stays off for real patient data until Caliber's BAA with Anthropic is signed." };
  return { on: true, why: production ? "AI reader on (BAA signed)." : "AI reader on. Demo: upload fake paperwork only." };
}
export const aiReaderEnabled = () => aiReaderStatus().on;

const SYSTEM = `You read paperwork for a durable medical equipment (DME) billing office: faxed referrals, prescriptions,
delivery tickets, purchase orders, Workers' Compensation RFA forms, VA referrals, insurance cards and chart notes.
Pages may be typed, handwritten, skewed or low quality.

Extract only what is actually written. Never guess or fill in a value that isn't on the page.
- If a value is missing, return null.
- Confidence: "high" when clearly legible; "medium" when you had to interpret handwriting or a smudge; "low" when
  you're unsure between readings. Explain anything unclear in readerNotes in plain words.
- Dates as YYYY-MM-DD. Sex as F, M or U. Names in capital letters. Phone numbers as written.
- ICD-10 diagnosis codes and HCPCS codes exactly as written (e.g. M25.561, E0218).
- payerTypeGuess: WC for workers' comp carriers/TPAs; VA_DIRECT for the VA itself; VA_CCN for VA community care
  administrators; otherwise MEDICARE, MEDICAID, COMMERCIAL, SELF_PAY or UNKNOWN.
- For each file (in the order given, index from 0) give the best document type from: ${DOC_TYPES.map((d) => d.code).join(", ")}.`;

let client: Anthropic | null = null;

async function readWithClaude(files: ReaderFile[]): Promise<Extraction> {
  client ??= new Anthropic();
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  files.forEach((f, i) => {
    content.push({ type: "text", text: `File ${i}: ${f.name}` });
    if (f.mimeType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") } });
    } else {
      const mt = f.mimeType as "image/png" | "image/jpeg" | "image/webp";
      content.push({ type: "image", source: { type: "base64", media_type: mt, data: f.data.toString("base64") } });
    }
  });
  content.push({ type: "text", text: "Read these files and return the fields." });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "high", format: betaZodOutputFormat(extraction) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The reader declined this document. Please enter the fields by hand.");
  if (!response.parsed_output) throw new Error("The reader couldn't produce the fields. Please enter them by hand.");
  return response.parsed_output;
}

export async function readPaperwork(files: ReaderFile[]): Promise<ReaderResult> {
  // When Claude is on it reads everything, including the samples, so you see the real thing.
  // When it's off (or fails) the fake samples still fill in from the demo reader.
  const demo = demoExtraction(files.map((f) => f.sha256));
  const fallback = (error?: string): ReaderResult => (demo ? { reader: "demo", extraction: demo, error } : { reader: "manual", extraction: null, error });
  if (!aiReaderEnabled()) return fallback();
  const supported = files.filter((f) => ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(f.mimeType));
  if (!supported.length) return fallback("These file types (TIFF, HEIC) can't be read automatically. Please enter the fields by hand.");
  try {
    return { reader: "claude", extraction: await readWithClaude(supported) };
  } catch (err) {
    // Typed SDK errors carry a status; never log document content.
    const msg =
      err instanceof Anthropic.RateLimitError
        ? "The reader is busy. Try again in a minute, or enter the fields by hand."
        : err instanceof Anthropic.APIError
          ? `The reader is unavailable (${err.status}). Please enter the fields by hand.`
          : err instanceof Error
            ? err.message
            : "The reader failed. Please enter the fields by hand.";
    return fallback(msg);
  }
}
