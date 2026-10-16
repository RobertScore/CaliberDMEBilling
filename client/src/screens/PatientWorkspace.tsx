// One patient's workspace. Everything about the account in one place, organized by what you're doing.
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, Receipt, Wallet, IdCard, MessageSquareText, ArrowRight, CheckCircle2, ShieldPlus, Clock, AlertTriangle, Printer, BellRing } from "lucide-react";
import { get } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { useNav, type Section } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { Avatar, CoverageBadge } from "@/components/ui";
import { ErrorBox, Modal, Money } from "@/components/inputs";
import { ageOn, isoToDisplay, todayIso } from "@shared/dates";
import { Activity } from "./Activity";
import { ChargeEntry } from "./ChargeEntry";
import { PaymentPosting } from "./PaymentPosting";
import { PatientForm } from "./PatientForm";
import { NotesAlerts } from "./NotesAlerts";

type Alert = { id: number; body: string; createdAt: string; createdBy: string };

/** What should happen next on this account, in plain words. */
function nextStep(L: LedgerView, can: (p: string) => boolean): { icon: ReactNode; text: string; action?: { label: string; section: Section } ; tone: string } {
  if (L.insurances.length === 0)
    return { icon: <ShieldPlus size={18} />, text: "No insurance on file yet. Add it before posting charges.", action: can("patient.edit") ? { label: "Add insurance", section: "details" } : undefined, tone: "amber" };
  if (L.encounters.length === 0)
    return { icon: <Receipt size={18} />, text: "Patient is set up. Next, post the charges for what was delivered.", action: can("charge.post") ? { label: "Post charges", section: "charge" } : undefined, tone: "navy" };
  const notBilled = L.encounters.filter((e) => e.claimStatus === "not_billed").length;
  if (L.balances.totalBalanceCents > 0)
    return {
      icon: <Wallet size={18} />,
      text: `${notBilled ? `${notBilled} claim${notBilled > 1 ? "s" : ""} ready to bill (billing arrives in Phase 2). ` : ""}Post payments as they come in.`,
      action: can("payment.post") ? { label: "Post a payment", section: "payment" } : undefined,
      tone: "navy",
    };
  if (L.balances.totalBalanceCents < 0) return { icon: <AlertTriangle size={18} />, text: "This account has a credit balance. Check for an overpayment or a refund due.", tone: "amber" };
  return { icon: <CheckCircle2 size={18} />, text: "All settled. The balance is zero.", tone: "green" };
}

export function PatientWorkspace({ id, section }: { id: number; section: Section }) {
  const nav = useNav();
  const { can } = useSession();
  const ledger = useQuery({ queryKey: ["ledger", id], queryFn: () => get<LedgerView>(`/api/patients/${id}/ledger`) });
  const alerts = useQuery({ queryKey: ["alerts", id], queryFn: () => get<Alert[]>(`/api/patients/${id}/alerts`) });
  const [alertsSeenFor, setAlertsSeenFor] = useState<number | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  // Spec: "ALERT WILL DISPLAY AS SOON AS YOU OPEN A PATIENT ACCOUNT, IF ONE IS PRESENT."
  useEffect(() => {
    if (alertsSeenFor !== id && alerts.data && alerts.data.length > 0) {
      setShowAlerts(true);
      setAlertsSeenFor(id);
    }
  }, [alerts.data, alertsSeenFor, id]);

  if (ledger.isLoading) return <div className="p-10 text-slate-500">Loading account…</div>;
  if (!ledger.data) return <div className="p-10"><ErrorBox error={ledger.error} /></div>;
  const L = ledger.data;
  const name = `${L.patient.lastName}, ${L.patient.firstName}`;
  const go = (s: Section) => nav.go({ name: "patient", id, section: s });
  const step = nextStep(L, can);
  const prim = L.insurances.find((i) => i.rank === 1);

  const tabs: { key: Section; label: string; icon: ReactNode; show: boolean; count?: number }[] = [
    { key: "activity", label: "Activity", icon: <ActivityIcon size={16} />, show: true },
    { key: "charge", label: "Post charges", icon: <Receipt size={16} />, show: can("charge.post") },
    { key: "payment", label: "Post a payment", icon: <Wallet size={16} />, show: can("payment.post") },
    { key: "details", label: "Patient & insurance", icon: <IdCard size={16} />, show: true },
    { key: "notes", label: "Notes & alerts", icon: <MessageSquareText size={16} />, show: true, count: alerts.data?.length || undefined },
  ];

  const toneCls: Record<string, string> = {
    navy: "border-navy-100 bg-navy-50/60 text-navy-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-accent-200 bg-accent-50 text-accent-800",
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      {/* Patient header */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <Avatar name={name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{name}</h1>
              <CoverageBadge type={L.patient.coverageType} />
              {!!alerts.data?.length && (
                <button onClick={() => setShowAlerts(true)} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-2xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                  <BellRing size={11} /> {alerts.data.length} alert{alerts.data.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>Account <span className="font-mono text-slate-700">#{L.patient.accountNumber}</span></span>
              <span>DOB {isoToDisplay(L.patient.dob)} ({ageOn(L.patient.dob, todayIso())})</span>
              {prim && <span>{prim.payerName}{prim.claimNumber ? ` · Claim ${prim.claimNumber}` : ""}</span>}
            </div>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xs text-slate-500">Insurance owes</div>
              <Money cents={L.balances.insuranceBalanceCents} className="text-lg font-semibold text-slate-800" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Patient owes</div>
              <Money cents={L.balances.patientBalanceCents} className="text-lg font-semibold text-slate-800" />
            </div>
            <div className="border-l border-slate-200 pl-6">
              <div className="text-xs text-slate-500">Balance</div>
              <Money cents={L.balances.totalBalanceCents} className="text-2xl font-semibold text-navy-800" />
            </div>
          </div>
        </div>

        {/* Next step */}
        <div className={`flex items-center gap-3 border-t px-6 py-3 text-sm ${toneCls[step.tone]}`}>
          {step.icon}
          <span className="flex-1">{step.text}</span>
          {step.action && section !== step.action.section && (
            <button className="btn btn-sm btn-primary" onClick={() => go(step.action!.section)}>
              {step.action.label} <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Sections */}
        <div className="no-print flex items-center gap-1 border-t border-slate-100 px-4">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.key}
              onClick={() => go(t.key)}
              className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition ${section === t.key ? "text-navy-800" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t.icon}
              {t.label}
              {t.count && <span className="rounded-full bg-red-100 px-1.5 text-2xs text-red-700">{t.count}</span>}
              {section === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-800" />}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {L.closedThrough && (
              <span className="mr-2 flex items-center gap-1 text-2xs text-slate-400">
                <Clock size={12} /> Books closed through {isoToDisplay(L.closedThrough)}
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Print">
              <Printer size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {section === "activity" && <Activity L={L} />}
        {section === "charge" && <ChargeEntry L={L} onDone={() => go("activity")} />}
        {section === "payment" && <PaymentPosting L={L} onDone={() => go("activity")} />}
        {section === "details" && <PatientForm patientId={id} onSaved={() => undefined} />}
        {section === "notes" && <NotesAlerts patientId={id} alerts={alerts.data ?? []} />}
      </div>

      {showAlerts && alerts.data && alerts.data.length > 0 && (
        <Modal title="Heads up on this account" subtitle={name} onClose={() => setShowAlerts(false)}>
          <div className="space-y-2">
            {alerts.data.map((a) => (
              <div key={a.id} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <BellRing size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <div className="text-sm text-slate-800">{a.body}</div>
                  <div className="mt-0.5 text-2xs text-slate-500">{new Date(a.createdAt).toLocaleString()} · {a.createdBy}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={() => { setShowAlerts(false); go("notes"); }}>Manage alerts</button>
            <button className="btn btn-primary" autoFocus onClick={() => setShowAlerts(false)}>Got it</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
