// FAKE sample paperwork for the local demo, so the intake flow can be tried end to end without real PHI.
// Generates small PDFs (a referral fax packet and a delivery ticket) and remembers what's on them, so the
// demo reader can "read" them. Real paperwork is read by the AI reader (when enabled) or typed in by staff.
import type { Extraction, ExtractedField } from "@shared/documents";
import { sha256 } from "./fileStore";

type Line = { x: number; y: number; size: number; text: string; font?: "F1" | "F2" | "F3" };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Minimal PDF writer: Helvetica (F1), Helvetica-Bold (F2), Courier-Oblique (F3, our stand-in for handwriting). */
export function makePdf(pages: Line[][]): Buffer {
  const objs: string[] = [];
  const add = (s: string) => objs.push(s) && objs.length;
  const catalog = add("");
  const pagesObj = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const f3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Oblique >>");
  const kids: number[] = [];
  for (const lines of pages) {
    const stream = lines
      .map((l) => `BT /${l.font ?? "F1"} ${l.size} Tf ${l.x} ${l.y} Td (${esc(l.text)}) Tj ET`)
      .concat(["0.6 w 40 40 532 712 re S"])
      .join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const f = (value: string | null, confidence: ExtractedField["confidence"] = "high"): ExtractedField => ({ value, confidence });
const none = () => f(null, "high");

function header(title: string, sub: string): Line[] {
  return [
    { x: 56, y: 740, size: 9, text: "*** SAMPLE DOCUMENT - FICTIONAL PERSON - FOR DEMO ONLY ***", font: "F2" },
    { x: 56, y: 712, size: 18, text: title, font: "F2" },
    { x: 56, y: 694, size: 10, text: sub },
  ];
}

function labelled(rows: [string, string][], startY: number, x = 56): Line[] {
  return rows.flatMap(([label, value], i) => [
    { x, y: startY - i * 24, size: 10, text: `${label}:`, font: "F2" as const },
    { x: x + 150, y: startY - i * 24, size: 12, text: value, font: "F3" as const },
  ]);
}

/** A new Work Comp referral that arrives by fax: cover sheet + prescription + demographics/RFA. */
function newReferral(): { name: string; pdf: Buffer; extraction: Extraction } {
  const pdf = makePdf([
    [
      ...header("FAX COVER SHEET", "From: Sample Orthopedic Clinic (FAKE)   To: Caliber DME Billing   Pages: 3"),
      { x: 56, y: 640, size: 12, text: "Re: New DME order - cold therapy unit, right knee", font: "F2" },
      { x: 56, y: 616, size: 11, text: "Please see attached prescription and patient information." },
    ],
    [
      ...header("PRESCRIPTION / ORDER", "Sample Orthopedic Clinic (FAKE) - ordering physician: DR. SAMPLE ORTHO"),
      ...labelled(
        [
          ["Patient", "SAMPLE, MARIA L"],
          ["DOB", "04/22/1979"],
          ["Diagnosis", "M25.561  S83.511A"],
          ["Item", "E0218 cold therapy unit w/ pump, E0236 pump"],
          ["Length of need", "30 days"],
          ["Physician signature", "/s/ Dr. Sample Ortho  09/20/2026"],
        ],
        640,
      ),
    ],
    [
      ...header("PATIENT INFORMATION / RFA", "Workers' Compensation"),
      ...labelled(
        [
          ["Last name", "SAMPLE"],
          ["First name", "MARIA"],
          ["Middle", "L"],
          ["Date of birth", "04/22/1979"],
          ["Sex", "F"],
          ["Address", "742 EXAMPLE AVE"],
          ["City / State / Zip", "SAN DIEGO, CA 92103"],
          ["Phone", "555-0142"],
          ["Employer", "DEMO LOGISTICS CO"],
          ["WC carrier", "GOLDEN STATE COMP MUTUAL (TEST)"],
          ["Claim #", "TEST-WC-7781"],
          ["Date of injury", "09/12/2026"],
          ["Adjuster", "PAT EXAMPLE  555-0177"],
          ["Authorization #", "AUTH-TEST-4410"],
        ],
        650,
      ),
    ],
  ]);
  return {
    name: "fax-new-referral-sample.pdf",
    pdf,
    extraction: {
      patient: {
        lastName: f("SAMPLE"), firstName: f("MARIA"), middleInitial: f("L", "medium"), dob: f("1979-04-22"), sex: f("F"), ssn: none(),
        address1: f("742 EXAMPLE AVE"), address2: none(), city: f("SAN DIEGO"), state: f("CA"), zip: f("92103"),
        phone: f("555-0142", "medium"), cellPhone: none(), email: none(), employer: f("DEMO LOGISTICS CO"),
      },
      insurances: [
        {
          rank: 1, payerName: f("GOLDEN STATE COMP MUTUAL (TEST)"), payerTypeGuess: "WC", memberId: none(), groupNumber: none(),
          claimNumber: f("TEST-WC-7781"), dateOfInjury: f("2026-09-12"), employerName: f("DEMO LOGISTICS CO"),
          adjusterName: f("PAT EXAMPLE", "medium"), adjusterPhone: f("555-0177", "low"), referralNumber: none(), authorizationNumber: f("AUTH-TEST-4410", "medium"),
        },
      ],
      orderingPhysician: f("DR. SAMPLE ORTHO"),
      diagnosisCodes: ["M25.561", "S83.511A"],
      hcpcsCodes: ["E0218", "E0236"],
      documents: [{ index: 0, docType: "rx", confidence: "medium", summary: "Fax packet: cover sheet, prescription for a cold therapy unit, and patient information / RFA." }],
      sections: [
        { fileIndex: 0, fromPage: 1, toPage: 1, docType: "other", belongsTo: "none", confidence: "high", summary: "Fax cover sheet" },
        { fileIndex: 0, fromPage: 2, toPage: 2, docType: "rx", belongsTo: "this_patient", confidence: "high", summary: "Prescription for a cold therapy unit" },
        { fileIndex: 0, fromPage: 3, toPage: 3, docType: "rfa", belongsTo: "this_patient", confidence: "medium", summary: "Patient information / RFA" },
      ],
      readerNotes: "Adjuster phone number is partly smudged. Please confirm 555-0177.",
    },
  };
}

/** A delivery ticket for a patient who is already on file in this client. */
function deliveryTicket(lastName: string): { name: string; pdf: Buffer; extraction: Extraction } {
  const pdf = makePdf([
    [
      ...header("DELIVERY TICKET / PROOF OF DELIVERY", "Sample DME delivery (FAKE)"),
      ...labelled(
        [
          ["Patient", `${lastName}, PATIENT ONE`],
          ["Date of birth", "01/01/1980"],
          ["Items delivered", "E0666 NU, E0650 RR"],
          ["Delivery date", "09/01/2026"],
          ["Received by (signature)", "/s/ Patient One"],
        ],
        650,
      ),
    ],
  ]);
  return {
    name: "email-delivery-ticket-sample.pdf",
    pdf,
    extraction: {
      patient: {
        lastName: f(lastName), firstName: f("PATIENT ONE"), middleInitial: none(), dob: f("1980-01-01"), sex: none(), ssn: none(),
        address1: none(), address2: none(), city: none(), state: none(), zip: none(), phone: none(), cellPhone: none(), email: none(), employer: none(),
      },
      insurances: [],
      orderingPhysician: none(),
      diagnosisCodes: [],
      hcpcsCodes: ["E0666", "E0650"],
      documents: [{ index: 0, docType: "delivery_ticket", confidence: "high", summary: "Signed delivery ticket for E0666 and E0650." }],
      sections: [{ fileIndex: 0, fromPage: 1, toPage: 1, docType: "delivery_ticket", belongsTo: "this_patient", confidence: "high", summary: "Signed delivery ticket" }],
      readerNotes: "",
    },
  };
}

const registry = new Map<string, Extraction>();

export function demoPacket(kind: "new" | "existing", clientLastName: string) {
  const p = kind === "new" ? newReferral() : deliveryTicket(clientLastName);
  registry.set(sha256(p.pdf), p.extraction);
  return p;
}

/** The demo reader only "reads" the sample paperwork generated above. */
export function demoExtraction(fileHashes: string[]): Extraction | null {
  for (const h of fileHashes) {
    const e = registry.get(h);
    if (e) return e;
  }
  return null;
}
