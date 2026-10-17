// Split one file of a packet into documents: each part runs from its first page to its last page and has a type,
// a verified tick, and file-or-set-aside. The reader suggests the parts; the reviewer can change anything.
import { useState } from "react";
import { Combine, Eye, Pencil, Scissors, Trash2 } from "lucide-react";
import type { Doc } from "@/lib/types";
import { Badge } from "./ui";
import { DOC_TYPES, docTypeLabel, type Extraction } from "@shared/documents";

export type Part = { fromPage: number; toPage: number; docType: string; verified: boolean; skip: boolean; summary?: string; belongsTo?: string };
const TYPES = DOC_TYPES.filter((d) => d.code !== "packet");

// One color per document type, used on the page map and the part cards.
const COLOR: Record<string, string> = {
  rx: "bg-sky-500", delivery_ticket: "bg-emerald-500", po: "bg-indigo-500", rfa: "bg-violet-500", rfs: "bg-purple-500", authorization: "bg-teal-500",
  chart_notes: "bg-amber-500", demographics: "bg-cyan-500", insurance_card: "bg-pink-500", referral: "bg-blue-600", eob: "bg-lime-600", other: "bg-slate-400",
};
const colorOf = (p: Part) => (p.skip ? "bg-slate-300" : COLOR[p.docType] ?? "bg-slate-400");

/** Can this file be split by page? (PDFs with a known page count.) */
export const splittable = (d: Doc) => d.mimeType === "application/pdf" && !!d.pageCount;

/** Starting parts for a file: the reader's suggestion, with neighbouring pages of the same document joined. */
export function initialParts(d: Doc, fileIndex: number, e: Extraction | null): Part[] {
  const whole: Part[] = [{ fromPage: 1, toPage: d.pageCount ?? 1, docType: d.docType === "packet" ? "other" : d.docType, verified: !!d.verifiedAt, skip: false }];
  if (!splittable(d)) return whole;
  const n = d.pageCount!;
  const suggested = (e?.sections ?? [])
    .filter((s) => s.fileIndex === fileIndex && s.fromPage >= 1 && s.toPage <= n && s.toPage >= s.fromPage)
    .sort((a, b) => a.fromPage - b.fromPage)
    .filter((s, i, arr) => i === 0 || s.fromPage > arr[i - 1].toPage); // drop overlaps
  if (!suggested.length) return whole;
  const parts: Part[] = [];
  for (const s of suggested) {
    const p: Part = { fromPage: s.fromPage, toPage: s.toPage, docType: TYPES.some((t) => t.code === s.docType) ? s.docType : "other", verified: false, skip: s.belongsTo !== "this_patient", summary: s.summary, belongsTo: s.belongsTo };
    const prev = parts[parts.length - 1];
    // The reader sometimes lists a multi-page document page by page: join consecutive pages of the same document.
    if (prev && prev.toPage + 1 === p.fromPage && prev.docType === p.docType && prev.belongsTo === p.belongsTo && !/duplicate/i.test(`${prev.summary} ${p.summary}`)) {
      prev.toPage = p.toPage;
      if (p.summary && p.summary !== prev.summary && !prev.summary?.includes(p.summary)) prev.summary = prev.summary ? prev.summary : p.summary;
    } else parts.push(p);
  }
  return parts;
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

const range = (a: number, b: number) => (a === b ? `Page ${a}` : `Pages ${a}–${b}`);

export function PacketParts({ doc, parts, onChange, onView, disabled }: { doc: Doc; parts: Part[]; onChange: (p: Part[]) => void; onView: (page: number) => void; disabled?: boolean }) {
  const canSplit = splittable(doc);
  const n = doc.pageCount ?? 1;
  const [editing, setEditing] = useState<number | null>(null);
  const sorted = parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.fromPage - b.p.fromPage);
  const set = (i: number, patch: Partial<Part>) => onChange(parts.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const { errors, uncovered } = checkParts(doc, parts);
  const partOfPage = (pg: number) => parts.find((p) => pg >= p.fromPage && pg <= p.toPage);

  const split = (i: number) => {
    const p = parts[i];
    const at = Math.floor((p.fromPage + p.toPage) / 2);
    onChange([...parts.slice(0, i), { ...p, toPage: at, verified: false }, { ...p, fromPage: at + 1, verified: false, summary: undefined }, ...parts.slice(i + 1)]);
  };
  const joinNext = (i: number) => {
    const p = parts[i];
    const next = parts.find((q) => q.fromPage === p.toPage + 1);
    if (!next) return;
    onChange(parts.filter((q) => q !== next).map((q) => (q === p ? { ...p, toPage: next.toPage, verified: false } : q)));
  };

  return (
    <div className="space-y-3">
      {canSplit && n > 1 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-2xs text-slate-500">
            <span>Page map: click a page to see it</span>
            <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 rounded-sm bg-slate-300" /> set aside <span className="inline-block h-2 w-3 rounded-sm border border-dashed border-slate-300 bg-white" /> not in a part</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: n }, (_, k) => k + 1).map((pg) => {
              const p = partOfPage(pg);
              return (
                <button key={pg} onClick={() => onView(pg)} title={p ? `${range(p.fromPage, p.toPage)}: ${p.skip ? "set aside" : docTypeLabel(p.docType)}` : `Page ${pg}: not in a part`}
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded text-[10px] font-semibold text-white transition hover:scale-110 ${p ? colorOf(p) : "border border-dashed border-slate-300 bg-white !text-slate-400"}`}>
                  {pg}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(({ p, i }) => (
          <div key={i} className={`flex overflow-hidden rounded-xl border bg-white ${p.belongsTo === "other_patient" ? "border-red-300" : "border-slate-200"} ${p.skip ? "opacity-70" : ""}`}>
            <div className={`w-1.5 shrink-0 ${colorOf(p)}`} />
            <div className="min-w-0 flex-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className={`h-8 rounded-lg border-0 bg-slate-50 px-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 ${p.skip ? "line-through" : ""}`} value={p.docType} disabled={disabled || p.skip} onChange={(e) => set(i, { docType: e.target.value })}>
                  {TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
                <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-navy-700 hover:bg-navy-50" onClick={() => onView(p.fromPage)} title="Show in the viewer">
                  <Eye size={13} /> {canSplit ? `${range(p.fromPage, p.toPage)}${p.toPage > p.fromPage ? ` · ${p.toPage - p.fromPage + 1} pages` : ""}` : "View"}
                </button>
                <span className="ml-auto flex items-center gap-2">
                  {canSplit && (
                    <span className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
                      <button disabled={disabled} className={`px-2.5 py-1 ${!p.skip ? "bg-navy-800 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => set(i, { skip: false })}>File</button>
                      <button disabled={disabled} className={`px-2.5 py-1 ${p.skip ? "bg-slate-600 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => set(i, { skip: true, verified: false })}>Set aside</button>
                    </span>
                  )}
                  {!p.skip && (
                    <label className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs ${p.verified ? "border-accent-300 bg-accent-50 text-accent-800" : "border-slate-200 text-slate-600"}`}>
                      <input type="checkbox" className="h-3.5 w-3.5" checked={p.verified} disabled={disabled} onChange={(e) => set(i, { verified: e.target.checked })} /> Verified
                    </label>
                  )}
                </span>
              </div>
              {(p.summary || p.belongsTo === "other_patient" || p.belongsTo === "none") && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {p.belongsTo === "other_patient" && <Badge tone="red">AI: about a different person</Badge>}
                  {p.belongsTo === "none" && <Badge tone="slate">AI: cover sheet / blank / junk</Badge>}
                  <span>{p.summary}</span>
                </div>
              )}
              {canSplit && !disabled && (
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  {editing === i ? (
                    <span className="flex items-center gap-1 text-slate-500">
                      Pages
                      <input type="number" min={1} max={n} className="input h-7 w-14 px-2 text-xs" value={p.fromPage} onChange={(e) => set(i, { fromPage: Number(e.target.value) })} aria-label="First page" />
                      to
                      <input type="number" min={1} max={n} className="input h-7 w-14 px-2 text-xs" value={p.toPage} onChange={(e) => set(i, { toPage: Number(e.target.value) })} aria-label="Last page" />
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Done</button>
                    </span>
                  ) : (
                    <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => setEditing(i)}><Pencil size={12} /> Edit pages</button>
                  )}
                  {p.toPage > p.fromPage && <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => split(i)} title="Split this part in two"><Scissors size={12} /> Split</button>}
                  {parts.some((q) => q.fromPage === p.toPage + 1) && <button className="btn btn-ghost btn-sm text-slate-500" onClick={() => joinNext(i)} title="Join with the next part"><Combine size={12} /> Join with next</button>}
                  {parts.length > 1 && <button className="btn btn-ghost btn-sm ml-auto text-slate-400 hover:text-red-600" onClick={() => onChange(parts.filter((_, k) => k !== i))} title="Remove this part (its pages stay in the packet only)"><Trash2 size={12} /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {canSplit && !disabled && uncovered.length > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([...parts, { fromPage: uncovered[0], toPage: uncovered.find((pg, k) => uncovered[k + 1] !== pg + 1) ?? uncovered[0], docType: "other", verified: false, skip: false }])}>
          + Add a part for page {uncovered[0]}{uncovered.length > 1 ? " onward" : ""}
        </button>
      )}
      {errors.map((e) => <div key={e} className="text-xs text-red-600">{e}</div>)}
      {uncovered.length > 0 && <div className="text-xs text-slate-500">Pages {uncovered.join(", ")} aren't in any part. They stay in the full packet in the Inbox only.</div>}
    </div>
  );
}
