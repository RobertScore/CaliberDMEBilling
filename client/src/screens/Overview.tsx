// The default patient screen: everything at a glance without clicking around.
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, Check, FileText, MessageSquareText, Plus, Receipt, ShieldCheck, Wallet } from "lucide-react";
import { post } from "@/lib/api";
import type { Overview as O, TimelineItem } from "@/lib/types";
import type { Section } from "@/lib/nav";
import { Badge, CoverageBadge, EmptyState } from "@/components/ui";
import { Money } from "@/components/inputs";
import { NoteComposer } from "@/components/NoteComposer";
import { ChecklistCard } from "./Documents";
import { isoToDisplay } from "@shared/dates";

const RANKS = ["Primary", "Secondary", "Tertiary"];

/** Several Work Comp claims are separate injuries, not primary/secondary coverage, so they're labeled as claims. */
function InsuranceCard({ ins, rank, onAdd, wcClaims = 0 }: { ins?: O["patient"]["insurances"][number]; rank: number; onAdd: () => void; wcClaims?: number }) {
  if (!ins)
    return (
      <button onClick={onAdd} className="flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:border-navy-300 hover:text-navy-700">
        <Plus size={18} /> Add {RANKS[rank - 1].toLowerCase()} insurance
      </button>
    );
  const rows: [string, string | null | undefined][] = [
    ["Member ID", ins.memberIdMasked],
    ["Claim #", ins.claimNumber],
    ["Group", ins.groupNumber],
    ["Date of injury", ins.dateOfInjury ? isoToDisplay(ins.dateOfInjury) : null],
    ["Employer", ins.employerName],
    ["Adjuster", [ins.adjusterName, ins.adjusterPhone].filter(Boolean).join(" · ") || null],
    ["VA referral #", ins.referralNumber],
    ["Authorization #", ins.authorizationNumber],
    ["Eligible", ins.eligibleFrom || ins.eligibleTo ? `${isoToDisplay(ins.eligibleFrom) || "…"} – ${isoToDisplay(ins.eligibleTo) || "…"}` : null],
  ];
  const expired = ins.eligibleTo && ins.eligibleTo < new Date().toISOString().slice(0, 10);
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">{ins.payerType === "WC" && wcClaims > 1 ? `Work Comp claim ${rank}` : RANKS[rank - 1]}</span>
        {ins.payerType && <CoverageBadge type={ins.payerType} />}
        {expired && <Badge tone="red">Eligibility ended</Badge>}
      </div>
      <div className="mt-1 font-semibold text-slate-900">{ins.payerName}</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-400">{k}</dt>
            <dd className="truncate font-medium text-slate-700">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const DOT: Record<string, string> = { note: "bg-navy-500", claim: "bg-amber-500", document: "bg-violet-500", charge: "bg-amber-600", payment: "bg-green-500", writeoff: "bg-red-500", pat_share: "bg-blue-500", refund: "bg-purple-500", adjustment: "bg-orange-500" };

function TimelineRow({ t, onDoc }: { t: TimelineItem; onDoc: (id: number) => void }) {
  const color = t.type === "money" ? DOT[t.kind] : DOT[t.type];
  return (
    <li className="relative flex gap-3 pb-4 pl-1">
      <span className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${color ?? "bg-slate-400"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-2xs text-slate-400">
          <span>{new Date(t.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          <span className="font-medium text-slate-500">{t.by}</span>
          {t.type === "note" && <Badge tone="slate">{t.category}</Badge>}
          {t.type === "note" && t.followUpDate && <span className="flex items-center gap-0.5 text-navy-600"><CalendarClock size={11} /> {isoToDisplay(t.followUpDate)}</span>}
        </div>
        {t.type === "note" && <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{t.text}</div>}
        {t.type === "money" && (
          <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
            <span className={`text-slate-700 ${t.reversal ? "italic" : ""}`}>{t.code && <span className="mr-1.5 font-mono text-xs text-slate-400">{t.code}</span>}{t.text}</span>
            <Money cents={t.amountCents} className="text-sm" />
          </div>
        )}
        {t.type === "claim" && <div className="mt-0.5 text-sm text-slate-700">{t.text}</div>}
        {t.type === "document" && (
          <button className="mt-0.5 flex items-center gap-1.5 text-sm text-violet-700 hover:underline" onClick={() => onDoc(t.documentId)}>
            <FileText size={13} /> {t.text} {t.verified && <ShieldCheck size={13} className="text-accent-600" />}
          </button>
        )}
      </div>
    </li>
  );
}

export function Overview({ o, go, onOpenDoc, compact, narrow }: { o: O; go: (s: Section) => void; onOpenDoc: (id: number) => void; compact?: boolean; narrow?: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "note" | "money" | "document">("all");
  const [q, setQ] = useState("");
  const done = useMutation({
    mutationFn: (id: number) => post(`/api/tasks/${id}/done`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overview", o.patient.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const timeline = useMemo(
    () => o.timeline.filter((t) => (filter === "all" || t.type === filter || (filter === "money" && t.type === "claim")) && (!q || t.text.toLowerCase().includes(q.toLowerCase()))),
    [o.timeline, filter, q],
  );
  const agingMax = Math.max(1, ...Object.values(o.aging).map((v) => Math.abs(v)));
  const ins = (r: number) => o.patient.insurances.find((i) => i.rank === r);
  // Full width: all three slots. Narrower: what's on file plus the next empty slot. Compact: what's on file.
  const showCard = (r: number) => !!ins(r) || (!compact && !narrow) || r === 1 || (!!narrow && !!ins(r - 1));

  return (
    <div className="space-y-5">
      {/* Side by side there's less room: show only the insurances on file, plus one "add" box. */}
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : narrow ? "grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
        {[1, 2, 3].filter(showCard).map((r) => <InsuranceCard key={r} rank={r} ins={ins(r)} onAdd={() => go("details")} wcClaims={o.patient.insurances.filter((i) => i.payerType === "WC").length} />)}
      </div>

      <div className={`grid gap-5 ${compact || narrow ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[1fr_340px]"}`}>
        <div className="space-y-5">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Claims</div>
              <button className="btn btn-ghost btn-sm" onClick={() => go("activity")}>Open ledger</button>
            </div>
            {o.claims.length === 0 ? (
              <EmptyState icon={<Receipt size={20} />} title="No claims yet" action={<button className="btn btn-sm btn-primary" onClick={() => go("charge")}>Post charges</button>} />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-2xs uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-2 font-medium">Service</th><th className="font-medium">Items</th>{!compact && <th className="font-medium">Payer</th>}<th className="font-medium">Status</th><th className="text-right font-medium">Billed</th>{!compact && <th className="text-right font-medium">Paid</th>}<th className="px-5 text-right font-medium">Balance</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {o.claims.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go("activity")}>
                      <td className="px-5 py-2.5 text-slate-700">{isoToDisplay(c.serviceDateFrom)}</td>
                      <td className="font-mono text-xs text-slate-500">{c.codes.join(", ")}</td>
                      {!compact && <td className="max-w-[160px] truncate text-slate-600">{c.payerName}</td>}
                      <td><Badge tone={c.status === "not_billed" ? "amber" : "green"}>{c.status === "not_billed" ? "Ready to bill" : c.status}</Badge></td>
                      <td className="text-right"><Money cents={c.billedCents} /></td>
                      {!compact && <td className="text-right"><Money cents={c.paidCents} /></td>}
                      <td className="px-5 text-right font-semibold"><Money cents={c.balanceCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title flex items-center gap-2"><MessageSquareText size={16} className="text-slate-400" /> Notes & history</div>
              <span className="text-2xs text-slate-400">Updates live as your team works</span>
            </div>
            <div className="border-b border-slate-100 p-4">
              <NoteComposer patientId={o.patient.id} overview={o} compact={compact} />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
              {(["all", "note", "money", "document"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {f === "all" ? "Everything" : f === "note" ? "Notes" : f === "money" ? "Charges & payments" : "Documents"}
                </button>
              ))}
              <input className="input ml-auto h-8 w-48 text-xs" placeholder="Search history…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ol className="relative mx-5 mt-4 before:absolute before:bottom-4 before:left-[9px] before:top-2 before:w-px before:bg-slate-200">
              {timeline.map((t, i) => <TimelineRow key={`${t.type}-${t.at}-${i}`} t={t} onDoc={onOpenDoc} />)}
              {timeline.length === 0 && <li className="pb-6 text-sm text-slate-400">Nothing here yet.</li>}
            </ol>
          </div>
        </div>

        <div className="space-y-5">
          {o.alerts.length > 0 && (
            <div className="card border-amber-200 bg-amber-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><BellRing size={15} /> Alerts</div>
              <ul className="space-y-1.5">{o.alerts.map((a) => <li key={a.id} className="text-sm text-slate-800">{a.body}</li>)}</ul>
            </div>
          )}

          <div className="card p-4">
            <div className="card-title mb-3">What's owed, by age</div>
            <div className="space-y-1.5">
              {Object.entries(o.aging).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-slate-500">{k} d</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${k === "0-30" ? "bg-accent-500" : k === "31-60" ? "bg-sky-500" : k === "61-90" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(Math.abs(v) / agingMax) * 100}%` }} />
                  </div>
                  <Money cents={v} className="w-20 text-right text-slate-700" />
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {o.lastPayment ? (
                <div className="flex gap-2">
                  <Wallet size={14} className="mt-0.5 shrink-0 text-green-600" />
                  <div>
                    <div>Last payment <Money cents={o.lastPayment.amountCents} className="font-semibold text-slate-800" /> on {isoToDisplay(o.lastPayment.date)}</div>
                    {o.lastPayment.payerName && <div className="text-slate-400">from {o.lastPayment.payerName}{o.lastPayment.checkNumber ? ` · check ${o.lastPayment.checkNumber}` : ""}</div>}
                  </div>
                </div>
              ) : (
                "No payments yet."
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="card-title">Ready-to-bill documents</div>
              <button className="btn btn-ghost btn-sm" onClick={() => go("documents")}>Documents</button>
            </div>
            <ChecklistCard checklist={o.checklist} onOpen={onOpenDoc} />
          </div>

          <div className="card p-4">
            <div className="card-title mb-3 flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" /> Follow-ups</div>
            {o.tasks.length === 0 && <div className="text-sm text-slate-400">None open. Add a follow-up date to a note.</div>}
            <ul className="space-y-2">
              {o.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <button className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 hover:border-accent-600 hover:bg-accent-50" onClick={() => done.mutate(t.id)} title="Mark done">
                    <Check size={11} className="text-transparent hover:text-accent-700" />
                  </button>
                  <div>
                    <div className="text-slate-800">{t.title}</div>
                    <div className={`text-2xs ${t.dueDate < new Date().toISOString().slice(0, 10) ? "text-red-600" : "text-slate-400"}`}>Due {isoToDisplay(t.dueDate)} · {t.assignedInitials ?? "unassigned"}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4 text-sm">
            <div className="card-title mb-2">Contact</div>
            <div className="space-y-0.5 text-slate-600">
              {o.patient.address1 && <div>{o.patient.address1}, {o.patient.city} {o.patient.state} {o.patient.zip}</div>}
              {o.patient.phone && <div>Phone {o.patient.phone}</div>}
              {o.patient.cellPhone && <div>Cell {o.patient.cellPhone}</div>}
              {o.patient.email && <div>{o.patient.email}</div>}
              {o.patient.employer && <div>Employer: {o.patient.employer}</div>}
              {o.patient.referringPhysician && <div>Referring: {o.patient.referringPhysician}</div>}
              {o.patient.ssnMasked && <div>SSN {o.patient.ssnMasked}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
