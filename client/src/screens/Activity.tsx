// The patient ledger, two ways:
//  - "By claim" (default): each claim with its items and every payment against it, in plain words.
//  - "Classic ledger": the color-coded line-by-line view the team knows from the old system (PT LEDGER tab).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2, LayoutList, Rows3, Receipt, FileText } from "lucide-react";
import { post } from "@/lib/api";
import type { Encounter, LedgerEntry, LedgerView } from "@/lib/types";
import { useSession } from "@/lib/session";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Modal, Money } from "@/components/inputs";
import { LEDGER_KINDS, type LedgerKind } from "@shared/picklists";
import { isoToDisplay } from "@shared/dates";
import { formatCents, sumCents } from "@shared/money";

const KIND_DOT: Record<string, string> = {
  charge: LEDGER_KINDS.charge.color,
  payment: "#22c55e",
  writeoff: "#ef4444",
  pat_share: "#3b82f6",
  refund: "#a855f7",
  adjustment: "#f97316",
};

const amount = (e: LedgerEntry) => e.insuranceDeltaCents + e.patientDeltaCents;

function plainWords(e: LedgerEntry) {
  if (e.reversesEntryId) return e.description;
  switch (e.kind) {
    case "payment": return `${e.description.startsWith("PATIENT") ? "Patient paid" : `${e.payerName ?? "Insurance"} paid`}${e.checkNumber ? ` · check #${e.checkNumber}` : ""}`;
    case "writeoff": return `Written off · ${e.description.toLowerCase()}`;
    case "pat_share": return `Moved to patient · ${e.description.toLowerCase()}`;
    default: return e.description;
  }
}

function EntryRow({ e, onReverse }: { e: LedgerEntry; onReverse?: () => void }) {
  return (
    <div className={`group flex items-center gap-3 px-5 py-2.5 text-sm ${e.reversed ? "opacity-50" : ""}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_DOT[e.kind] ?? "#94a3b8" }} />
      <div className={`min-w-0 flex-1 ${e.reversed ? "line-through" : ""}`}>
        <span className="text-slate-800">{e.kind === "charge" && e.code ? <span className="mr-2 font-mono text-xs text-slate-500">{e.code}</span> : null}{plainWords(e)}</span>
        {e.kind === "charge" && e.quantity && e.quantity > 1 && <span className="text-slate-400"> × {e.quantity}</span>}
      </div>
      <span className="hidden text-2xs text-slate-400 sm:inline">
        {isoToDisplay(e.postDate)} · {e.createdBy}
      </span>
      <Money cents={amount(e)} className={`w-28 text-right ${amount(e) < 0 ? "" : "font-medium text-slate-800"}`} />
      <span className="w-8">
        {onReverse && (
          <button className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100" title="Reverse this entry" onClick={onReverse}>
            <Undo2 size={14} />
          </button>
        )}
      </span>
    </div>
  );
}

function ClaimCard({ enc, entries, canReverse, onReverse }: { enc: Encounter; entries: LedgerEntry[]; canReverse: boolean; onReverse: (e: LedgerEntry) => void }) {
  const billed = sumCents(entries.filter((e) => e.kind === "charge").map(amount));
  const paid = -sumCents(entries.filter((e) => e.kind === "payment").map(amount));
  const adjusted = -sumCents(entries.filter((e) => e.kind === "writeoff").map(amount));
  const balance = sumCents(entries.map(amount));
  const charges = entries.filter((e) => e.kind === "charge");
  const postings = entries.filter((e) => e.kind !== "charge");
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Receipt size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">
            Claim · {isoToDisplay(enc.serviceDateFrom)}
            {enc.serviceDateTo !== enc.serviceDateFrom && ` – ${isoToDisplay(enc.serviceDateTo)}`}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {enc.diagnosisCodes.map((d, i) => (
              <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs text-slate-600">
                {String.fromCharCode(65 + i)} · {d}
              </span>
            ))}
          </div>
        </div>
        <Badge tone={enc.claimStatus === "not_billed" ? "amber" : "green"}>{enc.claimStatus === "not_billed" ? "Ready to bill" : enc.claimStatus.replace(/_/g, " ")}</Badge>
        <div className="flex gap-5 text-right text-xs">
          <div><div className="text-slate-400">Billed</div><Money cents={billed} className="text-sm text-slate-700" /></div>
          <div><div className="text-slate-400">Paid</div><Money cents={paid} className="text-sm text-slate-700" /></div>
          <div><div className="text-slate-400">Adjusted</div><Money cents={adjusted} className="text-sm text-slate-700" /></div>
          <div><div className="text-slate-400">Balance</div><Money cents={balance} className="text-sm font-semibold text-navy-800" /></div>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {charges.map((e) => <EntryRow key={e.id} e={e} onReverse={canReverse && !e.reversed && !e.reversesEntryId ? () => onReverse(e) : undefined} />)}
      </div>
      {postings.length > 0 && (
        <div className="divide-y divide-slate-50 border-t border-dashed border-slate-200 bg-slate-50/40">
          {postings.map((e) => <EntryRow key={e.id} e={e} onReverse={canReverse && !e.reversed && !e.reversesEntryId ? () => onReverse(e) : undefined} />)}
        </div>
      )}
    </div>
  );
}

export function Activity({ L }: { L: LedgerView }) {
  const { can } = useSession();
  const [mode, setMode] = useState<"claims" | "classic">("claims");
  const [reverse, setReverse] = useState<LedgerEntry | null>(null);
  const canReverse = can("ledger.reverse");

  if (L.entries.length === 0 && L.encounters.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={<FileText size={20} />} title="Nothing on this account yet" body="Charges and payments will show up here as they're posted." />
      </div>
    );
  }

  const accountLevel = L.entries.filter((e) => !e.encounterId);
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <div className="flex flex-wrap gap-3 text-2xs text-slate-500">
          {(["charge", "payment", "writeoff", "pat_share", "refund", "adjustment"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: KIND_DOT[k] }} />
              {LEDGER_KINDS[k].label}
            </span>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <button className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${mode === "claims" ? "bg-navy-800 text-white" : "text-slate-500"}`} onClick={() => setMode("claims")}>
            <LayoutList size={14} /> By claim
          </button>
          <button className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${mode === "classic" ? "bg-navy-800 text-white" : "text-slate-500"}`} onClick={() => setMode("classic")}>
            <Rows3 size={14} /> Classic ledger
          </button>
        </div>
      </div>

      {mode === "claims" ? (
        <>
          {[...L.encounters].reverse().map((enc) => (
            <ClaimCard key={enc.id} enc={enc} entries={L.entries.filter((e) => e.encounterId === enc.id)} canReverse={canReverse} onReverse={setReverse} />
          ))}
          {accountLevel.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-head"><div className="card-title">Account-level postings</div></div>
              <div className="divide-y divide-slate-50">
                {accountLevel.map((e) => <EntryRow key={e.id} e={e} onReverse={canReverse && !e.reversed && !e.reversesEntryId ? () => setReverse(e) : undefined} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        <ClassicLedger L={L} onReverse={canReverse ? setReverse : undefined} />
      )}
      <p className="no-print text-xs text-slate-400">Ledger entries are permanent. To fix a mistake, reverse it: an equal and opposite entry is added and the original stays visible.</p>

      {reverse && <ReverseModal entry={reverse} patientId={L.patient.id} onClose={() => setReverse(null)} />}
    </div>
  );
}

function ClassicLedger({ L, onReverse }: { L: LedgerView; onReverse?: (e: LedgerEntry) => void }) {
  let running = 0;
  const rows = [...L.entries].sort((a, b) => (a.serviceDateFrom ?? a.postDate).localeCompare(b.serviceDateFrom ?? b.postDate) || a.id - b.id);
  const color = (k: string) => LEDGER_KINDS[k as LedgerKind]?.color ?? "#fff";
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Post date</th><th className="font-medium">Serv date</th><th className="font-medium">Code</th><th className="font-medium">Description</th>
            <th className="text-right font-medium">Qty</th><th className="text-right font-medium">Ins amount</th><th className="text-right font-medium">Pt amount</th><th className="text-right font-medium">Total</th><th className="px-3 font-medium">By</th><th />
          </tr>
        </thead>
        <tbody>
          {L.encounters.map((e) => (
            <tr key={`c${e.id}`} style={{ background: LEDGER_KINDS.claim_data.color }}>
              <td className="px-3 py-1.5">{isoToDisplay(e.createdAt.slice(0, 10))}</td>
              <td>{isoToDisplay(e.serviceDateFrom)}</td>
              <td colSpan={6}><b>Claim data</b> · Dx {e.diagnosisCodes.map((d, i) => `${String.fromCharCode(65 + i)}:${d}`).join("  ")}</td>
              <td className="px-3">{e.createdBy}</td><td />
            </tr>
          ))}
          {rows.map((e) => {
            running += amount(e);
            return (
              <tr key={e.id} style={{ background: color(e.kind) }} className={e.reversed ? "line-through opacity-60" : ""}>
                <td className="px-3 py-1.5">{isoToDisplay(e.postDate)}</td>
                <td>{isoToDisplay(e.serviceDateFrom)}</td>
                <td className="font-mono">{e.code}</td>
                <td>{e.description}{e.payerName && e.kind !== "charge" ? ` · ${e.payerName}` : ""}</td>
                <td className="text-right">{e.quantity ?? ""}</td>
                <td className="money text-right">{formatCents(e.insuranceDeltaCents)}</td>
                <td className="money text-right">{e.patientDeltaCents ? formatCents(e.patientDeltaCents) : ""}</td>
                <td className="money text-right">{formatCents(running)}</td>
                <td className="px-3">{e.createdBy}</td>
                <td className="pr-2 text-right">{onReverse && !e.reversed && !e.reversesEntryId && <button className="underline" onClick={() => onReverse(e)}>reverse</button>}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 font-semibold">
          <tr>
            <td colSpan={5} className="px-3 py-2 text-right">Balances</td>
            <td className="money text-right">{formatCents(L.balances.insuranceBalanceCents)}</td>
            <td className="money text-right">{formatCents(L.balances.patientBalanceCents)}</td>
            <td className="money text-right">{formatCents(L.balances.totalBalanceCents)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ReverseModal({ entry, patientId, onClose }: { entry: LedgerEntry; patientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => post(`/api/ledger/${entry.id}/reverse`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", patientId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Entry reversed. The original stays on the ledger.");
      onClose();
    },
  });
  return (
    <Modal title="Reverse this entry?" subtitle={`${plainWords(entry)} · $${formatCents(amount(entry))}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">An equal and opposite entry will be added. Nothing is deleted.</p>
      <input className="input" autoFocus placeholder="Why? (for example: posted to the wrong patient)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3"><ErrorBox error={m.error} /></div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>Reverse entry</button>
      </div>
    </Modal>
  );
}
