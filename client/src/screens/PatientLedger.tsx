// Patient Ledger (Ctrl+L). Follows the PT LEDGER tab: color-coded postings, notes that can't be
// edited, alerts that pop up when the account opens, print, summary, and management-only remove.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import type { LedgerEntry, LedgerView } from "@/lib/types";
import { ErrorBox, Modal, Money } from "@/components/inputs";
import { LEDGER_KINDS, type LedgerKind } from "@shared/picklists";
import { isoToDisplay } from "@shared/dates";
import { formatCents } from "@shared/money";
import { useSession } from "@/lib/session";

type Note = { id: number; body: string; createdAt: string; createdBy: string };
type Alert = Note;

function rowColor(e: LedgerEntry, onClaim: boolean) {
  if (e.kind === "charge") return onClaim ? LEDGER_KINDS.charge_on_claim.color : LEDGER_KINDS.charge.color;
  return LEDGER_KINDS[e.kind as LedgerKind]?.color ?? "#fff";
}

export function PatientLedger({ patientId, open }: { patientId: number; open: (kind: "patient" | "charge" | "payment", patientId: number) => void }) {
  const qc = useQueryClient();
  const { can } = useSession();
  const [sortBy, setSortBy] = useState<"service" | "post">("service");
  const [showNotes, setShowNotes] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertsSeen, setAlertsSeen] = useState(false);
  const [reverse, setReverse] = useState<LedgerEntry | null>(null);

  const ledger = useQuery({ queryKey: ["ledger", patientId], queryFn: () => get<LedgerView>(`/api/patients/${patientId}/ledger`) });
  const alerts = useQuery({ queryKey: ["alerts", patientId], queryFn: () => get<Alert[]>(`/api/patients/${patientId}/alerts`) });

  // "ALERT WILL DISPLAY AS SOON AS YOU OPEN A PATIENT ACCOUNT, IF ONE IS PRESENT."
  useEffect(() => {
    if (!alertsSeen && alerts.data && alerts.data.length > 0) {
      setShowAlerts(true);
      setAlertsSeen(true);
    }
  }, [alerts.data, alertsSeen]);

  if (ledger.isLoading) return <div className="p-6 text-slate-500">Loading ledger…</div>;
  if (ledger.error || !ledger.data) return <div className="p-6"><ErrorBox error={ledger.error} /></div>;
  const L = ledger.data;
  const entries = [...L.entries].sort((a, b) =>
    sortBy === "post" ? a.postDate.localeCompare(b.postDate) || a.id - b.id : (a.serviceDateFrom ?? a.postDate).localeCompare(b.serviceDateFrom ?? b.postDate) || a.id - b.id,
  );
  const prim = L.insurances.find((i) => i.rank === 1);
  const sec = L.insurances.find((i) => i.rank === 2);
  const ter = L.insurances.find((i) => i.rank === 3);
  let running = 0;

  return (
    <div className="space-y-2 p-3">
      <div className="no-print flex flex-wrap items-center gap-1">
        <button className="btn" disabled={!can("payment.post")} onClick={() => open("payment", patientId)}>Post Pay</button>
        <button className="btn" onClick={() => setShowNotes(true)}>Notes</button>
        <button className="btn" onClick={() => setShowAlerts(true)}>
          Alerts{alerts.data?.length ? <span className="ml-1 rounded bg-red-600 px-1 text-[10px] text-white">{alerts.data.length}</span> : null}
        </button>
        <button className="btn" onClick={() => window.print()}>Print</button>
        <button className="btn" onClick={() => open("patient", patientId)}>Pat</button>
        <button className="btn" disabled={!can("charge.post")} onClick={() => open("charge", patientId)}>Charges</button>
        <button className="btn" onClick={() => setShowSummary(true)}>Summary</button>
        <button className="btn" disabled title="Phase 2: scanned documents">Scan</button>
        <button className="btn" disabled title="Phase 2: electronic claims">Prvw Elec</button>
        <label className="ml-auto flex items-center gap-1 text-[12px]">
          Sort by
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as "service" | "post")}>
            <option value="service">SERV DATE</option>
            <option value="post">POST DATE</option>
          </select>
        </label>
      </div>

      <div className="panel grid grid-cols-6 gap-x-4 gap-y-1 p-3 text-[12px]">
        <div><span className="label">Patient</span><div className="font-semibold">{L.patient.lastName}, {L.patient.firstName}</div></div>
        <div><span className="label">Acct #</span><div className="font-mono">{L.patient.accountNumber}</div></div>
        <div><span className="label">DOB</span><div>{isoToDisplay(L.patient.dob)}</div></div>
        <div><span className="label">Coverage</span><div>{L.patient.coverageType}</div></div>
        <div><span className="label">PT-share balance</span><div><Money cents={L.balances.patientBalanceCents} /></div></div>
        <div><span className="label">Balance</span><div className="text-base font-bold"><Money cents={L.balances.totalBalanceCents} /></div></div>
        <div className="col-span-2"><span className="label">Primary</span><div>{prim ? `${prim.payerName}${prim.claimNumber ? ` · Claim ${prim.claimNumber}` : ""}${prim.memberIdMasked ? ` · ID ${prim.memberIdMasked}` : ""}` : "NONE"}</div></div>
        <div className="col-span-2"><span className="label">Secondary</span><div>{sec?.payerName ?? "NONE"}</div></div>
        <div className="col-span-2"><span className="label">Tertiary</span><div>{ter?.payerName ?? "NONE"}</div></div>
      </div>

      <div className="no-print flex flex-wrap gap-2 text-[11px]">
        {(Object.keys(LEDGER_KINDS) as LedgerKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" style={{ background: LEDGER_KINDS[k].color }} />
            {LEDGER_KINDS[k].label}
          </span>
        ))}
        {L.closedThrough && <span className="ml-auto text-slate-500">Books closed through {isoToDisplay(L.closedThrough)}</span>}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1">Post date</th>
              <th>Serv date</th>
              <th>Code</th>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Ins amount</th>
              <th className="text-right">Pt amount</th>
              <th className="text-right">Total</th>
              <th className="px-2">By</th>
              <th className="no-print" />
            </tr>
          </thead>
          <tbody>
            {L.encounters.length === 0 && entries.length === 0 && (
              <tr><td colSpan={10} className="px-2 py-6 text-center text-slate-500">No activity yet.</td></tr>
            )}
            {L.encounters.map((e) => (
              <tr key={`enc-${e.id}`} style={{ background: LEDGER_KINDS.claim_data.color }}>
                <td className="px-2 py-1">{isoToDisplay(e.createdAt.slice(0, 10))}</td>
                <td>{isoToDisplay(e.serviceDateFrom)}{e.serviceDateTo !== e.serviceDateFrom && ` – ${isoToDisplay(e.serviceDateTo)}`}</td>
                <td colSpan={6}>
                  <b>Claim data</b> · Dx {e.diagnosisCodes.map((d, i) => `${String.fromCharCode(65 + i)}:${d}`).join("  ")} · bill to insurance #{e.insuranceRank} · status: {e.claimStatus.replace("_", " ")}
                </td>
                <td className="px-2">{e.createdBy}</td>
                <td className="no-print" />
              </tr>
            ))}
            {entries.map((e) => {
              running += e.insuranceDeltaCents + e.patientDeltaCents;
              return (
                <tr key={e.id} style={{ background: rowColor(e, false) }} className={e.reversed ? "opacity-60 line-through" : ""}>
                  <td className="px-2 py-1">{isoToDisplay(e.postDate)}</td>
                  <td>{isoToDisplay(e.serviceDateFrom)}</td>
                  <td className="font-mono">{e.code}</td>
                  <td>
                    {e.description}
                    {e.payerName && e.kind !== "charge" && <span className="text-slate-600"> · {e.payerName}</span>}
                    {e.depositDate && <span className="text-slate-600"> · dep {isoToDisplay(e.depositDate)}</span>}
                  </td>
                  <td className="text-right">{e.quantity ?? ""}</td>
                  <td className="text-right"><Money cents={e.insuranceDeltaCents} /></td>
                  <td className="text-right">{e.patientDeltaCents ? <Money cents={e.patientDeltaCents} /> : ""}</td>
                  <td className="text-right"><Money cents={running} /></td>
                  <td className="px-2">{e.createdBy}</td>
                  <td className="no-print pr-2 text-right">
                    {can("ledger.reverse") && !e.reversed && !e.reversesEntryId && (
                      <button className="text-[11px] text-navy-700 underline" onClick={() => setReverse(e)}>reverse</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 font-semibold">
            <tr>
              <td colSpan={5} className="px-2 py-1 text-right">Balances</td>
              <td className="text-right"><Money cents={L.balances.insuranceBalanceCents} /></td>
              <td className="text-right"><Money cents={L.balances.patientBalanceCents} /></td>
              <td className="text-right"><Money cents={L.balances.totalBalanceCents} /></td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="no-print text-[11px] text-slate-500">
        Ledger entries can't be edited or deleted. To fix a mistake, use “reverse”, which posts an equal and opposite entry.
      </p>

      {showNotes && <NotesModal patientId={patientId} onClose={() => setShowNotes(false)} />}
      {showAlerts && <AlertsModal patientId={patientId} alerts={alerts.data ?? []} onClose={() => setShowAlerts(false)} />}
      {showSummary && <SummaryModal L={L} onClose={() => setShowSummary(false)} />}
      {reverse && (
        <ReverseModal
          entry={reverse}
          onClose={() => setReverse(null)}
          onDone={() => {
            setReverse(null);
            qc.invalidateQueries({ queryKey: ["ledger", patientId] });
          }}
        />
      )}
    </div>
  );
}

function NotesModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useSession();
  const [body, setBody] = useState("");
  const notes = useQuery({ queryKey: ["notes", patientId], queryFn: () => get<Note[]>(`/api/patients/${patientId}/notes`) });
  const add = useMutation({
    mutationFn: () => post(`/api/patients/${patientId}/notes`, { body }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["notes", patientId] });
    },
  });
  return (
    <Modal title="Account notes" onClose={onClose} wide>
      {can("note.create") && (
        <div className="mb-3 space-y-2">
          <textarea className="input h-20 w-full py-1" placeholder="What did you do on this account? (emails received, requests sent, calls…)" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}>Add note</button>
            <span className="text-[11px] text-slate-500">Notes can't be edited or removed once saved.</span>
          </div>
          <ErrorBox error={add.error} />
        </div>
      )}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {notes.data?.map((n) => (
          <div key={n.id} className="rounded border border-slate-200 p-2">
            <div className="text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleString()} · {n.createdBy}</div>
            <div className="whitespace-pre-wrap">{n.body}</div>
          </div>
        ))}
        {notes.data?.length === 0 && <div className="text-slate-500">No notes yet.</div>}
      </div>
    </Modal>
  );
}

function AlertsModal({ patientId, alerts, onClose }: { patientId: number; alerts: Alert[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useSession();
  const [body, setBody] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["alerts", patientId] });
  const add = useMutation({ mutationFn: () => post(`/api/patients/${patientId}/alerts`, { body }), onSuccess: () => { setBody(""); refresh(); } });
  const remove = useMutation({ mutationFn: (id: number) => del(`/api/patients/${patientId}/alerts/${id}`), onSuccess: refresh });
  return (
    <Modal title="⚠ Alerts" onClose={onClose}>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-2 rounded border border-amber-300 bg-amber-50 p-2">
            <div>
              <div className="text-[11px] text-slate-500">{new Date(a.createdAt).toLocaleString()} · {a.createdBy}</div>
              <div>{a.body}</div>
            </div>
            {can("alert.manage") && <button className="text-[11px] text-red-700 underline" onClick={() => remove.mutate(a.id)}>remove</button>}
          </div>
        ))}
        {alerts.length === 0 && <div className="text-slate-500">No alerts on this account.</div>}
        {can("alert.manage") && (
          <div className="flex gap-2 pt-2">
            <input className="input flex-1" placeholder="New alert" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="btn btn-primary" disabled={!body.trim()} onClick={() => add.mutate()}>Add</button>
          </div>
        )}
        <ErrorBox error={add.error ?? remove.error} />
      </div>
    </Modal>
  );
}

function SummaryModal({ L, onClose }: { L: LedgerView; onClose: () => void }) {
  return (
    <Modal title="Financial summary" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <div className="label mb-1">Aged by service date</div>
          <table className="w-full"><tbody>
            {Object.entries(L.summary.aging).map(([k, v]) => (
              <tr key={k} className="border-t border-slate-100"><td className="py-0.5">{k} days</td><td className="text-right font-mono">{formatCents(v)}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <div className="label mb-1">Main account</div>
          <table className="w-full"><tbody>
            {Object.entries(L.summary.totalsByKind).map(([k, v]) => (
              <tr key={k} className="border-t border-slate-100"><td className="py-0.5">{LEDGER_KINDS[k as LedgerKind]?.label ?? k}</td><td className="text-right font-mono">{formatCents(v)}</td></tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold"><td>Grand total</td><td className="text-right font-mono">{formatCents(L.balances.totalBalanceCents)}</td></tr>
          </tbody></table>
        </div>
      </div>
    </Modal>
  );
}

function ReverseModal({ entry, onClose, onDone }: { entry: LedgerEntry; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMutation({ mutationFn: () => post(`/api/ledger/${entry.id}/reverse`, { reason }), onSuccess: onDone });
  return (
    <Modal title="Reverse an entry" onClose={onClose}>
      <p className="mb-2">
        This posts an equal and opposite entry for <b>{entry.description}</b> ({formatCents(entry.insuranceDeltaCents + entry.patientDeltaCents)}). The original stays on the ledger.
      </p>
      <input className="input w-full" autoFocus placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>Post reversal</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
      <div className="mt-2"><ErrorBox error={m.error} /></div>
    </Modal>
  );
}
