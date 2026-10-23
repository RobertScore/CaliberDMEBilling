// The patient account screen: the ledger is the main thing, with everything else around it.
// Follows the PT LEDGER tab: color-coded postings, claim data, claim submissions, Summary, Print, Notes, Alerts,
// Pend Calls / New Call, Scan / Find. Every action opens as a panel over this screen (see PatientWorkspace).
import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BellRing, CalendarClock, Check, FileText, FolderOpen, IdCard, ListChecks, MessageSquareText,
  PhoneCall, Plus, Search, Send, Trash2, Undo2, Wallet,
} from "lucide-react";
import { del, post } from "@/lib/api";
import type { ClaimEvent, Encounter, LedgerEntry, LedgerView, Overview } from "@/lib/types";
import type { Section } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useLedgerColors } from "@/lib/ledgerColors";
import { Badge, CoverageBadge, useToast } from "@/components/ui";
import { DateInput, ErrorBox, Modal, Money, Segmented, TextInput } from "@/components/inputs";
import { NoteComposer } from "@/components/NoteComposer";
import { ChecklistCard } from "./Documents";
import { CLAIM_STATUSES, LEDGER_KINDS, SUBMIT_METHODS, claimStatusLabel } from "@shared/picklists";
import { isoToDisplay, todayIso } from "@shared/dates";
import { formatCents, sumCents } from "@shared/money";

/** What a panel should open on: e.g. "post a payment to THIS claim". */
export type ActionContext = { encounterId?: number };
type Open = (s: Section, ctx?: ActionContext) => void;

const amount = (e: LedgerEntry) => e.insuranceDeltaCents + e.patientDeltaCents;
const KIND_FILTERS = [
  { code: "all", label: "All" },
  { code: "charge", label: "Charges" },
  { code: "payment", label: "Payments" },
  { code: "writeoff", label: "Write-offs" },
  { code: "pat_share", label: "Patient share" },
  { code: "refund", label: "Refunds" },
  { code: "adjustment", label: "Adjustments" },
  { code: "claims", label: "Claim activity" },
] as const;
type KindFilter = (typeof KIND_FILTERS)[number]["code"];

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "navy"> = { not_billed: "amber", billed: "navy", pending: "navy", denied: "red", appeal: "red", paid: "green", closed: "slate" };

export function plainWords(e: LedgerEntry) {
  if (e.reversesEntryId) return e.description;
  switch (e.kind) {
    case "payment": return `${e.description.startsWith("PATIENT") ? "Patient paid" : `${e.payerName ?? "Insurance"} paid`}${e.checkNumber ? ` · check #${e.checkNumber}` : ""}`;
    case "writeoff": return `Write-off · ${e.description.toLowerCase()}`;
    case "pat_share": return `Moved to patient · ${e.description.toLowerCase()}`;
    default: return e.description;
  }
}

type Row =
  | { t: "claim"; key: string; enc: Encounter }
  | { t: "event"; key: string; ev: ClaimEvent; enc: Encounter }
  | { t: "entry"; key: string; e: LedgerEntry; enc?: Encounter; running?: number; lineBalance?: number }
  | { t: "subtotal"; key: string; enc?: Encounter; entries: LedgerEntry[] };

// ---------------------------------------------------------------------------------------------------------------

export function Account({ o, L, open, compact }: { o: Overview; L: LedgerView; open: Open; compact?: boolean }) {
  const [showSummary, setShowSummary] = useState(false);
  return (
    <div className={`grid gap-5 ${compact ? "grid-cols-1" : "grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <div className="min-w-0 space-y-4">
        {showSummary && <FinancialSummary o={o} L={L} onClose={() => setShowSummary(false)} />}
        <Ledger L={L} open={open} compact={compact} onSummary={() => setShowSummary((v) => !v)} summaryOpen={showSummary} />
      </div>
      <RightRail o={o} L={L} open={open} compact={compact} />
    </div>
  );
}

// ---- The ledger ------------------------------------------------------------------------------------------------

function Ledger({ L, open, compact, onSummary, summaryOpen }: { L: LedgerView; open: Open; compact?: boolean; onSummary: () => void; summaryOpen: boolean }) {
  const { can } = useSession();
  const color = useLedgerColors();
  const [view, setView] = useState<"claims" | "date">("claims");
  const [order, setOrder] = useState<"serv_asc" | "serv_desc" | "post">("serv_desc");
  const [kind, setKind] = useState<KindFilter>("all");
  const [claimId, setClaimId] = useState<string>("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [showReversed, setShowReversed] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reverse, setReverse] = useState<LedgerEntry | null>(null);
  const [statusFor, setStatusFor] = useState<Encounter | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const encById = useMemo(() => new Map(L.encounters.map((e) => [e.id, e])), [L.encounters]);
  const hiddenReversed = L.entries.filter((e) => e.reversed || e.reversesEntryId).length;
  const servKey = (e: LedgerEntry) => (e.encounterId ? encById.get(e.encounterId)?.serviceDateFrom : null) ?? e.serviceDateFrom ?? e.postDate;

  // Which entries pass the filters.
  const matches = (e: LedgerEntry) => {
    if (!showReversed && (e.reversed || e.reversesEntryId)) return false;
    if (kind !== "all" && kind !== "claims" && e.kind !== kind) return false;
    if (kind === "claims") return false;
    if (claimId && String(e.encounterId ?? "acct") !== claimId) return false;
    if (from && e.postDate < from) return false;
    if (to && e.postDate > to) return false;
    if (q) {
      const hay = `${e.code ?? ""} ${e.description} ${plainWords(e)} ${e.payerName ?? ""} ${e.checkNumber ?? ""} ${e.claimControlNumber ?? ""} ${e.batchNumber ?? ""} ${e.createdBy} ${formatCents(amount(e))}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  };
  const eventMatches = (ev: ClaimEvent) =>
    (kind === "all" || kind === "claims") && (!claimId || String(ev.encounterId) === claimId) && (!q || `${claimStatusLabel(ev.status)} ${ev.sentTo ?? ""} ${ev.note ?? ""} ${ev.createdBy}`.toLowerCase().includes(q.toLowerCase()));
  const filtering = kind !== "all" || !!claimId || !!q || !!from || !!to;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const shown = L.entries.filter(matches);
    if (view === "claims") {
      const encs = [...L.encounters].sort((a, b) => (order === "serv_asc" ? a.serviceDateFrom.localeCompare(b.serviceDateFrom) || a.id - b.id : b.serviceDateFrom.localeCompare(a.serviceDateFrom) || b.id - a.id));
      for (const enc of encs) {
        if (claimId && claimId !== String(enc.id)) continue;
        const all = L.entries.filter((e) => e.encounterId === enc.id);
        const mine = shown.filter((e) => e.encounterId === enc.id);
        const evs = L.claimEvents.filter((ev) => ev.encounterId === enc.id && eventMatches(ev));
        if (filtering && !mine.length && !evs.length) continue;
        out.push({ t: "claim", key: `c${enc.id}`, enc });
        // Charges first (one per line, with that line's own balance), then everything else as it happened.
        const lineBal = (lineId: number | null) => (lineId ? sumCents(all.filter((e) => e.serviceLineId === lineId).map(amount)) : undefined);
        for (const e of mine.filter((x) => x.kind === "charge" && !x.reversesEntryId)) out.push({ t: "entry", key: `e${e.id}`, e, enc, lineBalance: lineBal(e.serviceLineId) });
        const rest = [
          ...mine.filter((x) => !(x.kind === "charge" && !x.reversesEntryId)).map((e) => ({ at: e.createdAt, row: { t: "entry", key: `e${e.id}`, e, enc } as Row })),
          ...evs.map((ev) => ({ at: ev.createdAt, row: { t: "event", key: `v${ev.id}`, ev, enc } as Row })),
        ].sort((a, b) => a.at.localeCompare(b.at));
        out.push(...rest.map((r) => r.row));
        out.push({ t: "subtotal", key: `s${enc.id}`, enc, entries: all });
      }
      const acct = shown.filter((e) => !e.encounterId);
      if (acct.length && (!claimId || claimId === "acct")) {
        out.push(...acct.map((e) => ({ t: "entry" as const, key: `e${e.id}`, e })));
        out.push({ t: "subtotal", key: "s-acct", entries: L.entries.filter((e) => !e.encounterId) });
      }
      return out;
    }
    // Date order: one running balance, like the old ledger.
    const keyOf = (e: LedgerEntry) => (order === "post" ? `${e.postDate} ${e.createdAt}` : `${servKey(e)} ${e.createdAt}`);
    const items: { k: string; row: Row }[] = shown.map((e) => ({ k: keyOf(e), row: { t: "entry", key: `e${e.id}`, e, enc: e.encounterId ? encById.get(e.encounterId) : undefined } }));
    for (const enc of L.encounters) {
      if (claimId && claimId !== String(enc.id)) continue;
      if (kind === "all" && !q) items.push({ k: `${order === "post" ? enc.createdAt.slice(0, 10) : enc.serviceDateFrom} ${enc.createdAt}!`, row: { t: "claim", key: `c${enc.id}`, enc } });
      for (const ev of L.claimEvents.filter((x) => x.encounterId === enc.id && eventMatches(x))) {
        items.push({ k: `${order === "post" ? ev.createdAt.slice(0, 10) : enc.serviceDateFrom} ${ev.createdAt}`, row: { t: "event", key: `v${ev.id}`, ev, enc } });
      }
    }
    items.sort((a, b) => a.k.localeCompare(b.k));
    if (order === "serv_desc") items.reverse();
    // Running balance always adds up oldest-first, whatever the display order.
    const chron = order === "serv_desc" ? [...items].reverse() : items;
    let run = 0;
    for (const it of chron) if (it.row.t === "entry") { run += amount(it.row.e); it.row.running = run; }
    return items.map((i) => i.row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, view, order, kind, claimId, q, from, to, showReversed]);

  const selectable = rows.filter((r) => r.t !== "subtotal");
  function onKey(ev: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(ev.key)) return;
    if (ev.target !== tableRef.current) return;
    ev.preventDefault();
    const i = selectable.findIndex((r) => r.key === selected);
    if (ev.key === "ArrowDown") setSelected(selectable[Math.min(selectable.length - 1, i + 1)]?.key ?? null);
    if (ev.key === "ArrowUp") setSelected(selectable[Math.max(0, i - 1)]?.key ?? null);
    if (ev.key === "Enter" && selected) setExpanded((x) => (x === selected ? null : selected));
    if (ev.key === "Escape") setExpanded(null);
  }

  const rowBg = (r: Row) => {
    if (r.t === "claim") return color("claim_data");
    if (r.t === "event") return color("claim_submission");
    if (r.t === "entry") {
      if (r.e.kind === "charge") return color(r.enc && r.enc.claimStatus !== "not_billed" ? "charge_on_claim" : "charge");
      return color(r.e.kind);
    }
    return undefined;
  };
  const cols = compact ? 7 : 9;

  return (
    <div className="card overflow-hidden">
      {/* Filters */}
      <div className="no-print space-y-2 border-b border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input h-8 pl-8 text-xs" placeholder="Search code, description, check #, payer, amount, initials…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the ledger" />
          </div>
          <select className="input h-8 w-auto text-xs" value={claimId} onChange={(e) => setClaimId(e.target.value)} aria-label="Claim">
            <option value="">All claims</option>
            {[...L.encounters].reverse().map((e) => <option key={e.id} value={e.id}>Claim {isoToDisplay(e.serviceDateFrom)} · {e.lines.map((l) => l.hcpcsCode).join(", ")}</option>)}
            {L.entries.some((e) => !e.encounterId) && <option value="acct">Account-level only</option>}
          </select>
          <select className="input h-8 w-auto text-xs" value={order} onChange={(e) => setOrder(e.target.value as typeof order)} aria-label="Sort by">
            <option value="serv_desc">Service date, newest first</option>
            <option value="serv_asc">Service date, oldest first</option>
            {view === "date" && <option value="post">Post date</option>}
          </select>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "claims" ? "bg-navy-800 text-white" : "text-slate-500"}`} onClick={() => setView("claims")}>By claim</button>
            <button className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "date" ? "bg-navy-800 text-white" : "text-slate-500"}`} onClick={() => setView("date")}>Date order</button>
          </div>
          <button className={`btn btn-sm ${summaryOpen ? "border-navy-300 bg-navy-50" : ""}`} onClick={onSummary} title="Aging and totals (old Summary button)"><ListChecks size={14} /> Summary</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {KIND_FILTERS.map((k) => (
            <button key={k.code} onClick={() => setKind(k.code)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium ${kind === k.code ? "border-navy-700 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {k.code !== "all" && <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: color(k.code === "claims" ? "claim_data" : k.code) }} />}
              {k.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-3 text-2xs text-slate-500">
            <label className="flex items-center gap-1"><input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} /> Show reversed{hiddenReversed && !showReversed ? ` (${hiddenReversed} hidden)` : ""}</label>
            <button className="underline-offset-2 hover:underline" onClick={() => setMoreFilters((v) => !v)}>{moreFilters ? "Fewer filters" : "Posted between…"}</button>
            {filtering && <button className="font-medium text-navy-700" onClick={() => { setKind("all"); setClaimId(""); setQ(""); setFrom(undefined); setTo(undefined); }}>Clear filters</button>}
          </span>
        </div>
        {moreFilters && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Posted from <DateInput value={from} onChange={setFrom} className="h-8 w-36" /> to <DateInput value={to} onChange={setTo} className="h-8 w-36" />
          </div>
        )}
      </div>

      {/* The grid */}
      <div ref={tableRef} tabIndex={0} onKeyDown={onKey} className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-navy-200" aria-label="Ledger. Arrow keys move, Enter opens a row.">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-2xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-1 p-0" />
              {!compact && <th className="px-2 py-2 font-medium">Post</th>}
              <th className="px-2 py-2 font-medium">Service</th>
              <th className="px-2 font-medium">Code</th>
              <th className="w-full px-2 font-medium">Description</th>
              <th className="whitespace-nowrap px-2 text-right font-medium">Insurance</th>
              <th className="px-2 text-right font-medium">Patient</th>
              <th className="px-2 text-right font-medium" title={view === "claims" ? "Each charge shows its line's balance; the claim total is underneath" : "Running balance"}>{view === "claims" ? "Balance" : "Running"}</th>
              {!compact && <th className="px-2 font-medium">By</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-slate-400">{L.entries.length ? "Nothing matches these filters." : "Nothing on this account yet. Post charges to start the ledger."}</td></tr>
            )}
            {rows.map((r) => {
              if (r.t === "subtotal") return <Subtotal key={r.key} r={r} compact={compact} />;
              const isSel = selected === r.key;
              const isOpen = expanded === r.key;
              const strike = r.t === "entry" && (r.e.reversed || !!r.e.reversesEntryId);
              return (
                <Fragment key={r.key}>
                  <tr
                    className={`group cursor-pointer border-t border-black/[0.04] ${isSel ? "outline outline-2 -outline-offset-2 outline-navy-500" : ""} ${strike ? "text-slate-400" : "text-slate-800"}`}
                    style={{ background: rowBg(r) }}
                    onClick={() => { setSelected(r.key); setExpanded((x) => (x === r.key ? null : r.key)); tableRef.current?.focus({ preventScroll: true }); }}
                  >
                    <td className="w-1 p-0"><span className={`block h-full min-h-[30px] w-1 ${r.t === "claim" ? "bg-pink-400" : ""}`} /></td>
                    {r.t === "claim" ? (
                      <ClaimCells enc={r.enc} L={L} compact={compact} canSubmit={can("claim.submit")} canPay={can("payment.post")} onStatus={() => setStatusFor(r.enc)} open={open} />
                    ) : r.t === "event" ? (
                      <>
                        {!compact && <td className="whitespace-nowrap px-2 py-1.5">{isoToDisplay(r.ev.createdAt.slice(0, 10))}</td>}
                        <td className="whitespace-nowrap px-2">{isoToDisplay(r.enc.serviceDateFrom)}</td>
                        <td className="px-2"><Send size={12} className="text-slate-400" /></td>
                        <td className="w-full max-w-0 truncate px-2" colSpan={4}>
                          <span className="font-medium">{r.ev.status === "billed" ? "Claim submitted" : `Claim status: ${claimStatusLabel(r.ev.status)}`}</span>
                          {r.ev.status === "billed" && <span className="text-slate-500"> · {SUBMIT_METHODS.find((m) => m.code === r.ev.method)?.label ?? r.ev.method}{r.ev.sentTo ? ` to ${r.ev.sentTo}` : ""}</span>}
                          {r.ev.note && <span className="text-slate-500"> · {r.ev.note}</span>}
                        </td>
                        {!compact && <td className="px-2">{r.ev.createdBy}</td>}
                      </>
                    ) : (
                      <>
                        {!compact && <td className="whitespace-nowrap px-2 py-1.5">{isoToDisplay(r.e.postDate)}</td>}
                        <td className="whitespace-nowrap px-2 py-1.5">{isoToDisplay(r.e.serviceDateFrom)}</td>
                        <td className="whitespace-nowrap px-2 font-mono">{r.e.code}</td>
                        <td className={`w-full max-w-0 truncate px-2 ${strike ? "line-through" : ""}`} title={r.e.description}>
                          {r.e.kind === "charge" ? r.e.description : plainWords(r.e)}
                          {r.e.quantity && r.e.quantity > 1 ? <span className="text-slate-500"> × {r.e.quantity}</span> : null}
                          {r.e.reversed && <span className="ml-1"><Badge tone="slate">reversed</Badge></span>}
                        </td>
                        <td className="money whitespace-nowrap px-2 text-right">{r.e.insuranceDeltaCents ? formatCents(r.e.insuranceDeltaCents) : ""}</td>
                        <td className="money whitespace-nowrap px-2 text-right">{r.e.patientDeltaCents ? formatCents(r.e.patientDeltaCents) : ""}</td>
                        <td className="money px-2 text-right text-slate-500">{r.running !== undefined ? formatCents(r.running) : r.lineBalance !== undefined ? formatCents(r.lineBalance) : ""}</td>
                        {!compact && <td className="px-2">{r.e.createdBy}</td>}
                      </>
                    )}
                  </tr>
                  {isOpen && r.t === "entry" && (
                    <tr className="bg-white"><td colSpan={cols} className="border-l-4 border-navy-500 p-0"><EntryDetail e={r.e} enc={r.enc} L={L} open={open} onReverse={() => setReverse(r.e)} /></td></tr>
                  )}
                  {isOpen && r.t === "claim" && (
                    <tr className="bg-white"><td colSpan={cols} className="border-l-4 border-pink-400 p-0"><ClaimDetail enc={r.enc} L={L} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <tr>
              <td />
              <td colSpan={compact ? 3 : 4} className="px-2 py-2 text-right text-slate-600">Account balance</td>
              <td className="money px-2 text-right">{formatCents(L.balances.insuranceBalanceCents)}</td>
              <td className="money px-2 text-right">{formatCents(L.balances.patientBalanceCents)}</td>
              <td className="money px-2 text-right text-navy-800">{formatCents(L.balances.totalBalanceCents)}</td>
              {!compact && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="no-print flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-2xs text-slate-400">
        <span>Click a row (or ↑ ↓ and Enter) for details and actions.</span>
        <span>Entries are permanent: a mistake is fixed by reversing it, and both stay on the ledger.</span>
        {L.closedThrough && <span>Books closed through {isoToDisplay(L.closedThrough)}.</span>}
      </div>

      {reverse && <ReverseModal entry={reverse} patientId={L.patient.id} onClose={() => setReverse(null)} />}
      {statusFor && <ClaimStatusModal enc={statusFor} L={L} onClose={() => setStatusFor(null)} />}
    </div>
  );
}

function ClaimCells({ enc, L, compact, canSubmit, canPay, onStatus, open }: { enc: Encounter; L: LedgerView; compact?: boolean; canSubmit: boolean; canPay: boolean; onStatus: () => void; open: Open }) {
  const ins = L.insurances.find((i) => i.rank === enc.insuranceRank);
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f(); };
  return (
    <>
      {!compact && <td className="whitespace-nowrap px-2 py-1.5">{isoToDisplay(enc.createdAt.slice(0, 10))}</td>}
      <td className="whitespace-nowrap px-2 py-1.5 font-semibold">
        {isoToDisplay(enc.serviceDateFrom)}{enc.serviceDateTo !== enc.serviceDateFrom && <span className="font-normal"> – {isoToDisplay(enc.serviceDateTo)}</span>}
      </td>
      <td className="w-full max-w-0 px-2 py-1" colSpan={5}>
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-x-2 truncate">
          <span className="font-semibold">Claim data</span>
          <span className="text-slate-600">Dx {enc.diagnosisCodes.map((d, i) => `${String.fromCharCode(65 + i)}:${d}`).join("  ")}</span>
          {ins && <span className="text-slate-600">· {ins.payerName}{ins.claimNumber ? ` #${ins.claimNumber}` : ""}</span>}
          <Badge tone={STATUS_TONE[enc.claimStatus] ?? "slate"}>{claimStatusLabel(enc.claimStatus)}</Badge>
          </span>
          <span className="no-print flex shrink-0 gap-1">
            {canSubmit && <button className="rounded-md bg-white/80 px-2 py-0.5 text-2xs font-medium text-navy-800 ring-1 ring-black/10 hover:bg-white" onClick={stop(onStatus)}>{enc.claimStatus === "not_billed" ? "Mark billed…" : "Status…"}</button>}
            {canPay && <button className="rounded-md bg-white/80 px-2 py-0.5 text-2xs font-medium text-navy-800 ring-1 ring-black/10 hover:bg-white" onClick={stop(() => open("payment", { encounterId: enc.id }))}>Post payment</button>}
            {canPay && <button className="rounded-md bg-white/80 px-2 py-0.5 text-2xs font-medium text-navy-800 ring-1 ring-black/10 hover:bg-white" onClick={stop(() => open("lines", { encounterId: enc.id }))}>Line items</button>}
          </span>
        </div>
      </td>
      {!compact && <td className="px-2">{enc.createdBy}</td>}
    </>
  );
}

function Subtotal({ r, compact }: { r: Extract<Row, { t: "subtotal" }>; compact?: boolean }) {
  const live = r.entries.filter((e) => !e.reversed && !e.reversesEntryId);
  const billed = sumCents(live.filter((e) => e.kind === "charge").map(amount));
  const paid = -sumCents(live.filter((e) => e.kind === "payment").map(amount));
  const adj = -sumCents(live.filter((e) => ["writeoff", "adjustment", "refund"].includes(e.kind)).map(amount));
  return (
    <tr className="border-t border-slate-200 bg-white text-2xs text-slate-500">
      <td />
      <td colSpan={compact ? 3 : 4} className="px-2 py-1.5 text-right">
        {r.enc ? "Claim" : "Account-level"} · billed <b className="money text-slate-700">${formatCents(billed)}</b> · paid <b className="money text-slate-700">${formatCents(paid)}</b>{adj ? <> · adjusted <b className="money text-slate-700">${formatCents(adj)}</b></> : null}
      </td>
      <td className="money px-2 text-right">{formatCents(sumCents(r.entries.map((e) => e.insuranceDeltaCents)))}</td>
      <td className="money px-2 text-right">{formatCents(sumCents(r.entries.map((e) => e.patientDeltaCents)))}</td>
      <td className="money px-2 text-right font-semibold text-navy-800">{formatCents(sumCents(r.entries.map(amount)))}</td>
      {!compact && <td />}
    </tr>
  );
}

/** Everything about one ledger entry, plus what you can do with it. */
function EntryDetail({ e, enc, L, open, onReverse }: { e: LedgerEntry; enc?: Encounter; L: LedgerView; open: Open; onReverse: () => void }) {
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [noting, setNoting] = useState(false);
  const [body, setBody] = useState("");
  const line = enc?.lines.find((l) => l.id === e.serviceLineId);
  const reversedBy = L.entries.find((x) => x.reversesEntryId === e.id);
  const original = e.reversesEntryId ? L.entries.find((x) => x.id === e.reversesEntryId) : undefined;
  const ref = `${plainWords(e)}, $${formatCents(amount(e))}, posted ${isoToDisplay(e.postDate)}`;
  const note = useMutation({
    mutationFn: () => post(`/api/patients/${L.patient.id}/notes`, { body: `Re: ${ref}. ${body.trim()}`, category: e.kind === "payment" ? "payment" : "general" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overview", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["notes", L.patient.id] });
      toast("Note added to the account.");
      setNoting(false);
      setBody("");
    },
  });
  const facts: [string, ReactNode][] = [
    ["Type", LEDGER_KINDS[e.kind as keyof typeof LEDGER_KINDS]?.label ?? e.kind],
    ["Entered", `${new Date(e.createdAt).toLocaleString()} by ${e.createdBy}`],
    ["Post date", isoToDisplay(e.postDate)],
    ["Service", e.serviceDateFrom ? `${isoToDisplay(e.serviceDateFrom)}${e.serviceDateTo && e.serviceDateTo !== e.serviceDateFrom ? ` – ${isoToDisplay(e.serviceDateTo)}` : ""}` : null],
    ["Deposit date", e.depositDate ? isoToDisplay(e.depositDate) : null],
    ["Payer / paid to", e.payerName],
    ["Payment type", e.paymentType],
    ["Check / ref #", e.checkNumber],
    ["Claim control #", e.claimControlNumber],
    ["Batch #", e.batchNumber],
    ["Reason code", e.reasonCode],
    ["Allowed", e.allowedCents != null ? `$${formatCents(e.allowedCents)}` : null],
    ["Applies to line", line ? `${line.lineNumber}: ${line.hcpcsCode} ${line.modifiers.join(" ")}` : e.encounterId ? "Whole claim" : "Whole account"],
    ["Insurance / patient", `$${formatCents(e.insuranceDeltaCents)} / $${formatCents(e.patientDeltaCents)}`],
    ["Reversed", reversedBy ? `Yes, on ${isoToDisplay(reversedBy.postDate)} by ${reversedBy.createdBy}: ${reversedBy.description.replace(/^REVERSAL: /, "")}` : null],
    ["Reverses", original ? `${plainWords(original)} ($${formatCents(amount(original))}, ${isoToDisplay(original.postDate)})` : null],
  ];
  return (
    <div className="p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-3">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-slate-400">{k}</dt><dd className="min-w-0 font-medium text-slate-700">{v}</dd></div>
        ))}
      </dl>
      <div className="no-print mt-3 flex flex-wrap gap-2">
        {enc && can("payment.post") && <button className="btn btn-sm" onClick={() => open("payment", { encounterId: enc.id })}><Wallet size={13} /> Post payment to this claim</button>}
        {enc && can("payment.post") && <button className="btn btn-sm" onClick={() => open("lines", { encounterId: enc.id })}><ListChecks size={13} /> Line item posting</button>}
        {can("adjustment.post") && <button className="btn btn-sm" onClick={() => open("adjust", { encounterId: enc?.id })}>Adjust / refund</button>}
        {can("note.create") && <button className="btn btn-sm" onClick={() => setNoting((v) => !v)}><MessageSquareText size={13} /> Note about this</button>}
        {can("ledger.reverse") && !e.reversed && !e.reversesEntryId && <button className="btn btn-sm text-red-700" onClick={onReverse}><Undo2 size={13} /> Reverse…</button>}
      </div>
      {noting && (
        <div className="no-print mt-3 flex gap-2">
          <input className="input h-9 flex-1" autoFocus placeholder={`Note about: ${ref}`} value={body} onChange={(ev) => setBody(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && body.trim() && note.mutate()} maxLength={3500} />
          <button className="btn btn-primary btn-sm" disabled={!body.trim() || note.isPending} onClick={() => note.mutate()}>Save note</button>
        </div>
      )}
      <ErrorBox error={note.error} />
    </div>
  );
}

function ClaimDetail({ enc, L }: { enc: Encounter; L: LedgerView }) {
  const events = L.claimEvents.filter((e) => e.encounterId === enc.id);
  return (
    <div className="grid gap-4 p-4 text-xs md:grid-cols-2">
      <div>
        <div className="mb-1 font-semibold text-slate-700">Lines on this claim</div>
        <table className="w-full">
          <tbody>
            {enc.lines.map((l) => {
              const bal = sumCents(L.entries.filter((e) => e.serviceLineId === l.id).map(amount));
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-1 pr-2 text-slate-400">{l.lineNumber}</td>
                  <td className="pr-2 font-mono">{l.hcpcsCode} {l.modifiers.join(" ")}</td>
                  <td className="pr-2">{l.description}</td>
                  <td className="pr-2 text-slate-500">Dx {l.diagnosisPointers}</td>
                  <td className="pr-2 text-right">{l.quantity} × ${formatCents(l.unitPriceCents)}</td>
                  <td className="money text-right font-medium" title="This line's balance (line-item postings only)">${formatCents(bal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-1 text-2xs text-slate-400">Line balances count postings made per line. Whole-claim payments show under the claim.</div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-slate-700">Claim history</div>
        <ul className="space-y-1">
          <li className="text-slate-600">{new Date(enc.createdAt).toLocaleString()} · {enc.createdBy} · charges posted</li>
          {events.map((ev) => (
            <li key={ev.id} className="text-slate-600">
              {new Date(ev.createdAt).toLocaleString()} · {ev.createdBy} · {claimStatusLabel(ev.previousStatus ?? "")} → <b>{claimStatusLabel(ev.status)}</b>
              {ev.method && ` (${SUBMIT_METHODS.find((m) => m.code === ev.method)?.label ?? ev.method}${ev.sentTo ? ` to ${ev.sentTo}` : ""})`}
              {ev.note && ` · ${ev.note}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---- Dialogs ---------------------------------------------------------------------------------------------------

function useLedgerRefresh(patientId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["ledger", patientId] });
    qc.invalidateQueries({ queryKey: ["overview", patientId] });
    qc.invalidateQueries({ queryKey: ["notes", patientId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function ReverseModal({ entry, patientId, onClose }: { entry: LedgerEntry; patientId: number; onClose: () => void }) {
  const toast = useToast();
  const refresh = useLedgerRefresh(patientId);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => post(`/api/ledger/${entry.id}/reverse`, { reason }),
    onSuccess: () => { refresh(); toast("Entry reversed. The original stays on the ledger."); onClose(); },
  });
  return (
    <Modal title="Reverse this entry?" subtitle={`${plainWords(entry)} · $${formatCents(amount(entry))}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">An equal and opposite entry will be added today. Nothing is deleted.</p>
      <input className="input" autoFocus placeholder="Why? (for example: posted to the wrong patient)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3"><ErrorBox error={m.error} /></div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>Reverse entry</button>
      </div>
    </Modal>
  );
}

/** Record that a claim was sent (how, to whom) or change where it stands. Nothing is sent to a payer from here. */
function ClaimStatusModal({ enc, L, onClose }: { enc: Encounter; L: LedgerView; onClose: () => void }) {
  const toast = useToast();
  const refresh = useLedgerRefresh(L.patient.id);
  const ins = L.insurances.find((i) => i.rank === enc.insuranceRank);
  const [status, setStatus] = useState<string>(enc.claimStatus === "not_billed" ? "billed" : enc.claimStatus);
  const [method, setMethod] = useState<string>("electronic");
  const [sentTo, setSentTo] = useState(ins?.payerName ?? "");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => post(`/api/encounters/${enc.id}/status`, { status, method: status === "billed" ? method : undefined, sentTo: sentTo.trim() || undefined, note: note.trim() || undefined }),
    onSuccess: () => { refresh(); toast(`Claim marked ${claimStatusLabel(status).toLowerCase()}. A note was added to the account.`); onClose(); },
  });
  return (
    <Modal title={`Claim ${isoToDisplay(enc.serviceDateFrom)}`} subtitle={`Now: ${claimStatusLabel(enc.claimStatus)}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="label mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {CLAIM_STATUSES.map((s) => (
              <button key={s.code} onClick={() => setStatus(s.code)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${status === s.code ? "border-navy-600 bg-navy-50 font-medium text-navy-800 ring-2 ring-navy-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{s.label}</button>
            ))}
          </div>
        </div>
        {status === "billed" && (
          <>
            <div>
              <div className="label mb-1.5">How was it sent?</div>
              <Segmented value={method} onChange={setMethod} options={SUBMIT_METHODS} />
            </div>
            <label className="field"><span className="label">Sent to</span><TextInput value={sentTo} onChange={setSentTo} maxLength={60} upper /></label>
            <p className="text-2xs text-slate-500">This records the submission on the ledger (white row). It doesn't send anything to the payer.</p>
          </>
        )}
        <label className="field"><span className="label">Note (optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={status === "denied" ? "Why was it denied?" : ""} /></label>
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending || (status === enc.claimStatus && !note.trim())} onClick={() => m.mutate()}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Financial summary (old "Summary" button) -----------------------------------------------------------------

function FinancialSummary({ o, L, onClose }: { o: Overview; L: LedgerView; onClose: () => void }) {
  const live = L.entries;
  const by = (k: string, side: "insuranceDeltaCents" | "patientDeltaCents") => sumCents(live.filter((e) => e.kind === k).map((e) => e[side]));
  const billedCents = sumCents(L.encounters.filter((e) => e.claimStatus !== "not_billed").flatMap((e) => e.lines.map((l) => l.chargeCents)));
  const rows: [string, string][] = [["Charges", "charge"], ["Payments", "payment"], ["Write-offs", "writeoff"], ["Patient share moved", "pat_share"], ["Refunds", "refund"], ["Adjustments", "adjustment"]];
  const agingMax = Math.max(1, ...Object.values(o.aging).map((v) => Math.abs(v)));
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="card-title">Financial summary</div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Hide</button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Aged by service date</div>
          <div className="space-y-1.5">
            {Object.entries(o.aging).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-24 whitespace-nowrap text-slate-500">{k} days</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${v < 0 ? "bg-amber-400" : "bg-navy-500"}`} style={{ width: `${(Math.abs(v) / agingMax) * 100}%` }} /></div>
                <Money cents={v} className="w-24 text-right" />
              </div>
            ))}
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="text-2xs uppercase tracking-wide text-slate-400">
            <tr><th className="pb-1 text-left font-semibold">Totals</th><th className="text-right font-semibold">Main (insurance)</th><th className="text-right font-semibold">Patient</th></tr>
          </thead>
          <tbody>
            {rows.map(([label, k]) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="py-1 text-slate-600">{label}</td>
                <td className="money text-right">{formatCents(by(k, "insuranceDeltaCents"))}</td>
                <td className="money text-right">{formatCents(by(k, "patientDeltaCents"))}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-100"><td className="py-1 text-slate-600">Billed on claims</td><td className="money text-right">{formatCents(billedCents)}</td><td /></tr>
            <tr className="border-t-2 border-slate-300 font-semibold"><td className="py-1">Balance</td><td className="money text-right">{formatCents(L.balances.insuranceBalanceCents)}</td><td className="money text-right">{formatCents(L.balances.patientBalanceCents)}</td></tr>
          </tbody>
        </table>
      </div>
      {o.lastPayment && <div className="mt-3 text-xs text-slate-500">Last payment: ${formatCents(o.lastPayment.amountCents)} on {isoToDisplay(o.lastPayment.date)}{o.lastPayment.payerName ? ` from ${o.lastPayment.payerName}` : ""}{o.lastPayment.checkNumber ? `, check #${o.lastPayment.checkNumber}` : ""}</div>}
    </div>
  );
}

// ---- Right side: insurance, alerts, calls, notes, documents ----------------------------------------------------

function RailCard({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <div className="card-title flex-1">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RightRail({ o, L, open, compact }: { o: Overview; L: LedgerView; open: Open; compact?: boolean }) {
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const pid = o.patient.id;
  const [alertBody, setAlertBody] = useState("");
  const [addingAlert, setAddingAlert] = useState(false);
  const [callTitle, setCallTitle] = useState("");
  const [callDue, setCallDue] = useState<string | undefined>(todayIso());
  const [addingCall, setAddingCall] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["overview", pid] }); qc.invalidateQueries({ queryKey: ["tasks"] }); };
  const addAlert = useMutation({ mutationFn: () => post(`/api/patients/${pid}/alerts`, { body: alertBody }), onSuccess: () => { refresh(); setAlertBody(""); setAddingAlert(false); toast("Alert added. It will pop up when the account is opened."); } });
  const removeAlert = useMutation({ mutationFn: (id: number) => del(`/api/patients/${pid}/alerts/${id}`), onSuccess: refresh });
  const addCall = useMutation({ mutationFn: () => post("/api/tasks", { patientId: pid, title: callTitle, dueDate: callDue }), onSuccess: () => { refresh(); setCallTitle(""); setAddingCall(false); toast("Follow-up call added to the Call List."); } });
  const doneCall = useMutation({ mutationFn: (id: number) => post(`/api/tasks/${id}/done`), onSuccess: refresh });
  const ranks = ["Primary", "Secondary", "Tertiary"];

  return (
    <aside className={`no-print space-y-4 ${compact ? "" : "min-[1400px]:sticky min-[1400px]:top-4 min-[1400px]:self-start"}`}>
      {/* Alerts first: they matter most when they exist. */}
      {(o.alerts.length > 0 || can("alert.manage")) && (
        <RailCard title="Alerts" icon={<BellRing size={15} />} action={can("alert.manage") && <button className="btn btn-ghost btn-sm" onClick={() => setAddingAlert((v) => !v)}><Plus size={13} /> Alert</button>}>
          {o.alerts.length === 0 && !addingAlert && <div className="text-xs text-slate-400">No alerts on this account.</div>}
          <div className="space-y-1.5">
            {o.alerts.map((a) => (
              <div key={a.id} className="group flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                <span className="flex-1">{a.body}<span className="block text-2xs text-amber-700/70">{new Date(a.createdAt).toLocaleDateString()} · {a.createdBy}</span></span>
                {can("alert.manage") && <button className="self-start text-amber-700/60 opacity-0 hover:text-red-700 group-hover:opacity-100" title="Remove alert" onClick={() => removeAlert.mutate(a.id)}><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
          {addingAlert && (
            <div className="mt-2 flex gap-2">
              <input className="input h-8 flex-1 text-xs" autoFocus placeholder="Warning or info shown on open…" value={alertBody} onChange={(e) => setAlertBody(e.target.value)} maxLength={500} onKeyDown={(e) => e.key === "Enter" && alertBody.trim() && addAlert.mutate()} />
              <button className="btn btn-primary btn-sm" disabled={!alertBody.trim()} onClick={() => addAlert.mutate()}>Add</button>
            </div>
          )}
        </RailCard>
      )}

      <RailCard title="Pending calls" icon={<PhoneCall size={15} />} action={can("task.manage") && <button className="btn btn-ghost btn-sm" onClick={() => setAddingCall((v) => !v)}><Plus size={13} /> New call</button>}>
        {o.tasks.length === 0 && !addingCall && <div className="text-xs text-slate-400">No follow-ups due on this account.</div>}
        <ul className="space-y-1">
          {o.tasks.map((t) => {
            const late = t.dueDate < todayIso();
            return (
              <li key={t.id} className="flex items-start gap-2 text-xs">
                {can("task.manage") && <button className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 text-transparent hover:border-accent-500 hover:text-accent-600" title="Mark done" onClick={() => doneCall.mutate(t.id)}><Check size={11} /></button>}
                <span className="flex-1 text-slate-700">{t.title}<span className={`block text-2xs ${late ? "font-medium text-red-600" : "text-slate-400"}`}><CalendarClock size={10} className="mr-0.5 inline" />{isoToDisplay(t.dueDate)}{late ? " · overdue" : ""}{t.assignedInitials ? ` · ${t.assignedInitials}` : ""}</span></span>
              </li>
            );
          })}
        </ul>
        {addingCall && (
          <div className="mt-2 space-y-2">
            <input className="input h-8 text-xs" autoFocus placeholder="What to follow up on (e.g. call adjuster about payment)" value={callTitle} onChange={(e) => setCallTitle(e.target.value)} maxLength={200} />
            <div className="flex gap-2">
              <DateInput value={callDue} onChange={setCallDue} className="h-8 flex-1" />
              <button className="btn btn-primary btn-sm" disabled={!callTitle.trim() || !callDue || addCall.isPending} onClick={() => addCall.mutate()}>Add call</button>
            </div>
            <ErrorBox error={addCall.error} />
          </div>
        )}
      </RailCard>

      <RailCard title="Notes" icon={<MessageSquareText size={15} />} action={<button className="btn btn-ghost btn-sm" onClick={() => open("notes")}>All notes</button>}>
        {can("note.create") && <NoteComposer patientId={pid} overview={o} compact />}
        <ul className="mt-3 space-y-2">
          {o.notes.slice(0, 4).map((n) => (
            <li key={n.id} className="border-l-2 border-slate-200 pl-2 text-xs">
              <div className="text-2xs text-slate-400">{new Date(n.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {n.createdBy}{n.followUpDate ? ` · follow up ${isoToDisplay(n.followUpDate)}` : ""}</div>
              <div className="line-clamp-3 whitespace-pre-wrap text-slate-700">{n.body}</div>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Insurance" icon={<IdCard size={15} />} action={<button className="btn btn-ghost btn-sm" onClick={() => open("details")}>Edit</button>}>
        {o.patient.insurances.length === 0 && <div className="text-xs text-slate-400">No insurance on file.</div>}
        <ul className="space-y-2">
          {[...o.patient.insurances].sort((a, b) => a.rank - b.rank).map((i) => (
            <li key={i.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">{ranks[i.rank - 1]}</span>
                {i.payerType && <CoverageBadge type={i.payerType} />}
                {i.eligibleTo && i.eligibleTo < todayIso() && <Badge tone="red">Ended</Badge>}
              </div>
              <div className="font-medium text-slate-800">{i.payerName}</div>
              <div className="text-slate-500">
                {[i.claimNumber && `Claim ${i.claimNumber}`, i.memberIdMasked && `ID ${i.memberIdMasked}`, i.dateOfInjury && `DOI ${isoToDisplay(i.dateOfInjury)}`, i.authorizationNumber && `Auth ${i.authorizationNumber}`, i.referralNumber && `Ref ${i.referralNumber}`].filter(Boolean).join(" · ")}
              </div>
              {(i.adjusterName || i.adjusterPhone) && <div className="text-slate-500">Adjuster {[i.adjusterName, i.adjusterPhone].filter(Boolean).join(" · ")}</div>}
            </li>
          ))}
        </ul>
      </RailCard>

      {can("document.view") && (
        <RailCard title="Documents" icon={<FolderOpen size={15} />} action={<button className="btn btn-ghost btn-sm" onClick={() => open("documents")}>Open</button>}>
          <ChecklistCard checklist={o.checklist} onOpen={() => open("documents")} />
        </RailCard>
      )}
      <p className="px-1 text-2xs text-slate-400"><FileText size={10} className="mr-0.5 inline" />Account opened {isoToDisplay(o.patient.createdAt.slice(0, 10))} by {o.patient.createdBy} · {L.encounters.length} claim{L.encounters.length === 1 ? "" : "s"}</p>
    </aside>
  );
}
