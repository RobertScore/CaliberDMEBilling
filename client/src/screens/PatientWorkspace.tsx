// One patient's workspace: the account screen, with the ledger as the main feature (PT LEDGER tab).
// Every action (charges, payments, line items, adjustments, notes, documents, patient details) opens as a panel
// over the ledger, so the billing team never leaves this screen. Each open patient keeps its own open panel.
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Receipt, Wallet, IdCard, MessageSquareText, FolderOpen, Printer, BellRing, Columns2, X, Smartphone, ListChecks, Scale } from "lucide-react";
import { get, post } from "@/lib/api";
import type { LedgerView, Overview as O } from "@/lib/types";
import { useNav, type Section } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { Avatar, CoverageBadge } from "@/components/ui";
import { ErrorBox, Modal, Money } from "@/components/inputs";
import { Drawer } from "@/components/Drawer";
import { ageOn, isoToDisplay, todayIso } from "@shared/dates";
import { Account, type ActionContext } from "./Account";
import { ChargeEntry } from "./ChargeEntry";
import { LinePosting } from "./LinePosting";
import { AdjustRefund } from "./AdjustRefund";
import { PaymentPosting } from "./PaymentPosting";
import { PatientForm } from "./PatientForm";
import { NotesAlerts } from "./NotesAlerts";
import { Documents } from "./Documents";

/** Panels that open over the ledger, with their keyboard shortcuts (old system's, where it had one). */
const PANELS: Partial<Record<Section, { title: string; keys?: string }>> = {
  charge: { title: "Post charges", keys: "Ctrl+K" },
  payment: { title: "Post a payment", keys: "Ctrl+P" },
  lines: { title: "Line item posting", keys: "Ctrl+U" },
  adjust: { title: "Adjustment or refund", keys: "Ctrl+J" },
  notes: { title: "Notes & alerts" },
  documents: { title: "Documents" },
  details: { title: "Patient & insurance" },
};

/** Give the patient their own portal login (they see only their own account). */
function PortalInvite({ id }: { id: number }) {
  const [email, setEmail] = useState("");
  const m = useMutation({ mutationFn: () => post<{ email: string; temporaryPassword: string }>(`/api/patients/${id}/portal-invite`, { email }) });
  return (
    <div className="card mt-5 p-5">
      <div className="card-title mb-1 flex items-center gap-2"><Smartphone size={15} className="text-slate-400" /> Patient portal</div>
      <p className="mb-3 text-sm text-slate-500">Give this patient a login to see their own account, upload photos of paperwork and message the office.</p>
      {m.data ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">Account created for <b>{m.data.email}</b>. Temporary password (shown once, share privately): <span className="select-all font-mono">{m.data.temporaryPassword}</span></div>
      ) : (
        <div className="flex gap-2">
          <input className="input max-w-sm" placeholder="Patient's email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" disabled={!email.includes("@") || m.isPending} onClick={() => m.mutate()}>Create portal login</button>
        </div>
      )}
      <div className="mt-2"><ErrorBox error={m.error} /></div>
    </div>
  );
}

export function PatientWorkspace({ id, section, compact, narrow, onClose }: { id: number; section: Section; compact?: boolean; narrow?: boolean; onClose?: () => void }) {
  const nav = useNav();
  const { can } = useSession();
  const ov = useQuery({ queryKey: ["overview", id], queryFn: () => get<O>(`/api/patients/${id}/overview`) });
  const ledger = useQuery({ queryKey: ["ledger", id], queryFn: () => get<LedgerView>(`/api/patients/${id}/ledger`) });
  const [ctx, setCtx] = useState<ActionContext>({});
  const [alertsShown, setAlertsShown] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [focusDoc, setFocusDoc] = useState<number | null>(null);

  // Spec: "ALERT WILL DISPLAY AS SOON AS YOU OPEN A PATIENT ACCOUNT, IF ONE IS PRESENT." Once per opening.
  useEffect(() => {
    if (!alertsShown && ov.data && ov.data.alerts.length > 0) {
      setShowAlerts(true);
      setAlertsShown(true);
    }
  }, [ov.data, alertsShown]);

  if (ov.isLoading || ledger.isLoading) return <div className="p-10 text-slate-500">Loading account…</div>;
  if (!ov.data || !ledger.data) return <div className="p-10"><ErrorBox error={ov.error ?? ledger.error} /></div>;
  const L = ledger.data;
  const o = ov.data;
  const p = o.patient;
  const name = `${p.lastName}, ${p.firstName}`;
  const go = (s: Section) => nav.setSection(id, s);
  const open = (s: Section, c: ActionContext = {}) => { setCtx(c); go(s); };
  const close = () => { setCtx({}); setFocusDoc(null); go("overview"); };
  const panel = PANELS[section];
  const prim = p.insurances.find((i) => i.rank === 1);
  const docsToDo = o.checklist.missingCount + o.checklist.unverifiedCount;

  const actions: { key: Section; label: string; icon: ReactNode; show: boolean; keys?: string; count?: number; tone?: string }[] = [
    { key: "charge", label: "Post charges", icon: <Receipt size={15} />, show: can("charge.post"), keys: "Ctrl+K" },
    { key: "payment", label: "Post payment", icon: <Wallet size={15} />, show: can("payment.post"), keys: "Ctrl+P" },
    { key: "lines", label: "Line items", icon: <ListChecks size={15} />, show: can("payment.post") && L.encounters.length > 0, keys: "Ctrl+U" },
    { key: "adjust", label: "Adjust / refund", icon: <Scale size={15} />, show: can("adjustment.post"), keys: "Ctrl+J" },
    { key: "notes", label: "Notes & alerts", icon: <MessageSquareText size={15} />, show: true, count: o.alerts.length || undefined, tone: "red" },
    { key: "documents", label: "Documents", icon: <FolderOpen size={15} />, show: can("document.view"), count: docsToDo || undefined, tone: "amber" },
    { key: "details", label: "Patient & insurance", icon: <IdCard size={15} />, show: true },
  ];

  return (
    <div className={compact ? "px-4 py-4" : "mx-auto w-full max-w-[1800px] px-6 py-5"}>
      <div className="card overflow-hidden">
        <div className={`flex flex-wrap items-center gap-4 ${compact ? "p-4" : "p-5"}`}>
          <Avatar name={name} size={compact ? 40 : 52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={`truncate font-semibold tracking-tight text-slate-900 ${compact ? "text-base" : "text-xl"}`}>{name}</h1>
              <CoverageBadge type={p.coverageType} />
              {o.alerts.length > 0 && (
                <button onClick={() => setShowAlerts(true)} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-2xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                  <BellRing size={11} /> {o.alerts.length} alert{o.alerts.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
              <span>Account <span className="font-mono text-slate-700">#{p.accountNumber}</span></span>
              <span>DOB {isoToDisplay(p.dob)} ({ageOn(p.dob, todayIso())})</span>
              {prim && !compact && <span>{prim.payerName}{prim.claimNumber ? ` · Claim ${prim.claimNumber}` : ""}</span>}
            </div>
          </div>
          <div className="flex gap-5 text-right">
            {!compact && (
              <>
                <div>
                  <div className="text-xs text-slate-500">Insurance owes</div>
                  <Money cents={o.balances.insuranceCents} className="text-lg font-semibold text-slate-800" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Patient owes</div>
                  <Money cents={o.balances.patientCents} className="text-lg font-semibold text-slate-800" />
                </div>
              </>
            )}
            <div className={compact ? "" : "border-l border-slate-200 pl-5"}>
              <div className="text-xs text-slate-500">Balance</div>
              <Money cents={o.balances.totalCents} className={`font-semibold text-navy-800 ${compact ? "text-lg" : "text-2xl"}`} />
            </div>
          </div>
          {onClose && (
            <button className="self-start rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} title="Close side-by-side">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="no-print flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-2">
          {actions.filter((t) => t.show && (!compact || ["charge", "payment", "notes", "documents"].includes(t.key))).map((t) => (
            <button
              key={t.key}
              onClick={() => open(t.key)}
              title={t.keys ? `${t.label} (${t.keys})` : t.label}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${section === t.key ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {t.icon}
              {t.label}
              {t.count && <span className={`rounded-full px-1.5 text-2xs ${t.tone === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{t.count}</span>}
            </button>
          ))}
          {!compact && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                className="btn btn-ghost btn-sm"
                title="Show another patient side by side"
                onClick={() => nav.pickPatient("Show side by side with this patient…", (otherId, label) => {
                  nav.openPatient(otherId, label);
                  nav.openPatient(id, name);
                  nav.setSplit(otherId);
                })}
              >
                <Columns2 size={15} /> Side by side
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Print the ledger">
                <Printer size={15} /> Print
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Account o={o} L={L} open={open} compact={compact || narrow} />
      </div>

      {panel && (
        <Drawer title={panel.title} subtitle={<>{name} · #{p.accountNumber}{panel.keys ? ` · ${panel.keys}` : ""}</>} onClose={close}>
          {section === "charge" && <ChargeEntry L={L} onDone={close} />}
          {section === "payment" && <PaymentPosting L={L} encounterId={ctx.encounterId} onDone={close} />}
          {section === "lines" && <LinePosting L={L} encounterId={ctx.encounterId} onDone={close} />}
          {section === "adjust" && <AdjustRefund L={L} encounterId={ctx.encounterId} onDone={close} />}
          {section === "documents" && <Documents patientId={id} focusDocId={focusDoc} key={focusDoc ?? 0} />}
          {section === "details" && (
            <>
              <PatientForm patientId={id} onSaved={() => undefined} />
              {can("portal.invite") && <PortalInvite id={id} />}
            </>
          )}
          {section === "notes" && <NotesAlerts patientId={id} alerts={o.alerts} overview={o} />}
        </Drawer>
      )}

      {showAlerts && o.alerts.length > 0 && (
        <Modal title="Heads up on this account" subtitle={name} onClose={() => setShowAlerts(false)}>
          <div className="space-y-2">
            {o.alerts.map((a) => (
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
            <button className="btn" onClick={() => { setShowAlerts(false); open("notes"); }}>Manage alerts</button>
            <button className="btn btn-primary" autoFocus onClick={() => setShowAlerts(false)}>Got it</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
