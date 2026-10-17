// Split one file of a packet into parts: page range, document type, verified, and file-or-set-aside.
// The reader suggests the parts; the reviewer can change anything before filing.
import { Eye, Plus, Trash2 } from "lucide-react";
import type { Doc } from "@/lib/types";
import { Badge } from "./ui";
import { Select } from "./inputs";
import { DOC_TYPES, type Extraction } from "@shared/documents";

export type Part = { fromPage: number; toPage: number; docType: string; verified: boolean; skip: boolean; summary?: string; belongsTo?: string };
const TYPES = DOC_TYPES.filter((d) => d.code !== "packet");

/** Can this file be split by page? (PDFs with a known page count.) */
export const splittable = (d: Doc) => d.mimeType === "application/pdf" && !!d.pageCount;

/** Starting parts for a file: the reader's suggestion if it makes sense, otherwise one part for the whole file. */
export function initialParts(d: Doc, fileIndex: number, e: Extraction | null): Part[] {
  const whole: Part[] = [{ fromPage: 1, toPage: d.pageCount ?? 1, docType: d.docType === "packet" ? "other" : d.docType, verified: !!d.verifiedAt, skip: false }];
  if (!splittable(d)) return whole;
  const n = d.pageCount!;
  const suggested = (e?.sections ?? [])
    .filter((s) => s.fileIndex === fileIndex && s.fromPage >= 1 && s.toPage <= n && s.toPage >= s.fromPage)
    .sort((a, b) => a.fromPage - b.fromPage)
    .filter((s, i, arr) => i === 0 || s.fromPage > arr[i - 1].toPage); // drop overlaps
  if (!suggested.length) return whole;
  return suggested.map((s) => ({
    fromPage: s.fromPage, toPage: s.toPage, docType: TYPES.some((t) => t.code === s.docType) ? s.docType : "other",
    verified: false, skip: s.belongsTo !== "this_patient", summary: s.summary, belongsTo: s.belongsTo,
  }));
}

/** Problems that would stop filing, plus pages that aren't in any part (allowed: they stay in the packet only). */
export function checkParts(d: Doc, parts: Part[]) {
  const n = d.pageCount ?? 1;
  const errors: string[] = [];
  const sorted = [...parts].sort((a, b) => a.fromPage - b.fromPage);
  sorted.forEach((p, i) => {
    if (!Number.isInteger(p.fromPage) || !Number.isInteger(p.toPage) || p.fromPage < 1 || p.toPage > n || p.toPage < p.fromPage) errors.push(`Pages ${p.fromPage}-${p.toPage} aren't valid (this file has ${n} page${n === 1 ? "" : "s"}).`);
    if (i > 0 && p.fromPage <= sorted[i - 1].toPage) errors.push(`Pages ${sorted[i - 1].fromPage}-${sorted[i - 1].toPage} and ${p.fromPage}-${p.toPage} overlap.`);
  });
  const covered = new Set(parts.flatMap((p) => Array.from({ length: Math.max(0, p.toPage - p.fromPage + 1) }, (_, k) => p.fromPage + k)));
  const uncovered = Array.from({ length: n }, (_, k) => k + 1).filter((pg) => !covered.has(pg));
  return { errors, uncovered };
}

const pagesLabel = (a: number, b: number) => (a === b ? `p. ${a}` : `pp. ${a}-${b}`);

export function PacketParts({ doc, parts, onChange, onView, disabled }: { doc: Doc; parts: Part[]; onChange: (p: Part[]) => void; onView: (page: number) => void; disabled?: boolean }) {
  const canSplit = splittable(doc);
  const n = doc.pageCount ?? 1;
  const set = (i: number, patch: Partial<Part>) => onChange(parts.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const { errors, uncovered } = checkParts(doc, parts);
  const nextStart = Math.max(0, ...parts.map((p) => p.toPage)) + 1;

  return (
    <div className="space-y-1.5">
      {parts.map((p, i) => (
        <div key={i} className={`rounded-lg border p-2 ${p.skip ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200"} ${p.belongsTo === "other_patient" ? "border-red-300 bg-red-50/50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50" onClick={() => onView(p.fromPage)} title="Show in the viewer">
              <Eye size={13} /> {canSplit ? pagesLabel(p.fromPage, p.toPage) : "View"}
            </button>
            {canSplit && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <input type="number" min={1} max={n} className="input h-8 w-16 px-2 text-xs" value={p.fromPage} disabled={disabled} onChange={(e) => set(i, { fromPage: Number(e.target.value) })} aria-label="First page" />
                to
                <input type="number" min={1} max={n} className="input h-8 w-16 px-2 text-xs" value={p.toPage} disabled={disabled} onChange={(e) => set(i, { toPage: Number(e.target.value) })} aria-label="Last page" />
              </span>
            )}
            <div className="w-56">
              <Select value={p.docType} onChange={(v) => set(i, { docType: v })} options={TYPES} disabled={disabled || p.skip} className="h-8 text-xs" />
            </div>
            {canSplit && (
              <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={p.skip ? "skip" : "file"} disabled={disabled} onChange={(e) => set(i, { skip: e.target.value === "skip", verified: e.target.value === "skip" ? false : p.verified })}>
                <option value="file">File to this patient</option>
                <option value="skip">Set aside (not for this patient)</option>
              </select>
            )}
            {!p.skip && (
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={p.verified} disabled={disabled} onChange={(e) => set(i, { verified: e.target.checked })} /> Verified
              </label>
            )}
            {canSplit && parts.length > 1 && !disabled && (
              <button className="ml-auto rounded p-1 text-slate-400 hover:text-red-600" onClick={() => onChange(parts.filter((_, k) => k !== i))} title="Remove this part (its pages stay in the packet only)">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          {(p.summary || p.belongsTo === "other_patient" || p.belongsTo === "none") && (
            <div className="mt-1 flex flex-wrap items-center gap-2 pl-1 text-2xs text-slate-500">
              {p.belongsTo === "other_patient" && <Badge tone="red">Reader: about a different person</Badge>}
              {p.belongsTo === "none" && <Badge tone="slate">Reader: cover / blank / junk</Badge>}
              {p.summary}
            </div>
          )}
        </div>
      ))}
      {canSplit && !disabled && nextStart <= n && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([...parts, { fromPage: nextStart, toPage: n, docType: "other", verified: false, skip: false }])}>
          <Plus size={13} /> Add part (pages {nextStart}-{n})
        </button>
      )}
      {errors.map((e) => <div key={e} className="text-xs text-red-600">{e}</div>)}
      {uncovered.length > 0 && <div className="text-xs text-slate-500">Pages {uncovered.join(", ")} aren't in any part. They stay in the full packet in the Inbox only.</div>}
    </div>
  );
}
