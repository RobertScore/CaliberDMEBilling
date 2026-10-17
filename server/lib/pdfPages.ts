// Page tools for packets: count a PDF's pages and copy a page range into a new PDF.
// Runs entirely on our server (pdf-lib); nothing is sent anywhere.
import { PDFDocument } from "pdf-lib";

/** Number of pages, or null if the file isn't a readable PDF (e.g. password-protected). */
export async function pdfPageCount(data: Buffer): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(data, { ignoreEncryption: false, updateMetadata: false });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}

/** A new PDF holding pages fromPage..toPage (1-based, inclusive) of the original. */
export async function extractPages(data: Buffer, fromPage: number, toPage: number): Promise<Buffer> {
  const src = await PDFDocument.load(data, { updateMetadata: false });
  const count = src.getPageCount();
  if (fromPage < 1 || toPage > count || toPage < fromPage) throw new RangeError(`Pages ${fromPage}-${toPage} are outside this ${count}-page file`);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}
