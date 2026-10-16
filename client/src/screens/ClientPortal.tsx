// The client portal: a DME distributor sees ONLY their own patients and billing, sends paperwork,
// runs reports, and (admins) manages their own portal users. No SSNs or member IDs are shown here.
import { useRef, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileWarning, Inbox, Loader2, Upload, UserPlus, Users, Wallet, Receipt, BadgeDollarSign } from "lucide-react";
import { get, post, api, uploadFiles } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Checklist } from "@/lib/types";
import { PortalFrame } from "@/components/PortalFrame";
import { Page } from "@/components/Shell";
import { Badge, CoverageBadge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Field, Modal, Money } from "@/components/inputs";
import { ChecklistCard } from "./Documents";
import { Reports } from "./Reports";
import { isoToDisplay } from "@shared/dates";

type Tab = "home" | "patients" | "send" | "reports" | "users";
type Dash = { clientName: string; patients: number; insuranceOwedCents: number; patientOwedCents: number; claimsBeingPrepared: number; collectedThisMonthCents: number; missingDocuments: number; paperworkInReview: number };
type P = { id: number; accountNumber: string; lastName: string; firstName: string; dob: string; coverageType: string; balanceCents: number; claims: number; missingDocuments: number };
type Claim = { id: number; serviceDateFrom: string; status: string; statusText: string; billedCents: number; paidCents: number; balanceCents: number };
type Detail = { id: number; accountNumber: string; lastName: string; firstName: string; dob: string; coverageType: string; insurances: { rank: number; payerName: string; payerType: string; claimNumber: string | null }[]; claims: Claim[]; checklist: Checklist };

function Stat({ icon, label, value, tone }: { icon: ReactElement; label: string; value: ReactElement | number; tone: string }) {
  return (
    <div className="card p-5">
      <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function Dashboard({ go }: { go: (t: Tab) => void }) {
  const q = useQuery({ queryKey: ["portal", "dashboard"], queryFn: () => get<Dash>("/api/portal/client/dashboard") });
  const d = q.data;
  return (
    <Page title={d ? `Welcome, ${d.clientName}` : "Welcome"} subtitle="Your billing at a glance. Only your company's patients are shown.">
      <ErrorBox error={q.error} />
      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={<Wallet size={18} />} tone="bg-navy-50 text-navy-700" label="Owed by insurance" value={<Money cents={d.insuranceOwedCents} />} />
            <Stat icon={<BadgeDollarSign size={18} />} tone="bg-accent-50 text-accent-700" label="Collected this month" value={<Money cents={d.collectedThisMonthCents} />} />
            <Stat icon={<Receipt size={18} />} tone="bg-amber-50 text-amber-700" label="Claims being prepared" value={d.claimsBeingPrepared} />
            <Stat icon={<Users size={18} />} tone="bg-sky-50 text-sky-700" label="Patients" value={d.patients} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <button className="card flex items-center gap-4 p-5 text-left hover:shadow-lift" onClick={() => go("patients")}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600"><FileWarning size={18} /></span>
              <span className="flex-1"><span className="block font-semibold text-slate-900">{d.missingDocuments} documents missing</span><span className="text-sm text-slate-500">Send these so we can bill. See which patients need what.</span></span>
            </button>
            <button className="card flex items-center gap-4 p-5 text-left hover:shadow-lift" onClick={() => go("send")}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><Inbox size={18} /></span>
              <span className="flex-1"><span className="block font-semibold text-slate-900">{d.paperworkInReview} uploads being processed</span><span className="text-sm text-slate-500">Send new orders, delivery tickets and other paperwork.</span></span>
            </button>
          </div>
        </>
      )}
    </Page>
  );
}

function PatientDetail({ id, back, send }: { id: number; back: () => void; send: (id: number) => void }) {
  const q = useQuery({ queryKey: ["portal", "patient", id], queryFn: () => get<Detail>(`/api/portal/client/patients/${id}`) });
  const p = q.data;
  return (
    <Page title={p ? `${p.lastName}, ${p.firstName}` : "Patient"} subtitle={p ? `Account #${p.accountNumber} · DOB ${isoToDisplay(p.dob)}` : undefined} actions={<><button className="btn" onClick={back}><ArrowLeft size={15} /> All patients</button>{p && <button className="btn btn-primary" onClick={() => send(p.id)}><Upload size={15} /> Send paperwork</button>}</>}>
      <ErrorBox error={q.error} />
      {p && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2"><div className="card-title">Insurance</div><CoverageBadge type={p.coverageType} /></div>
              {p.insurances.map((i) => <div key={i.rank} className="text-sm text-slate-700">{["Primary", "Secondary", "Tertiary"][i.rank - 1]}: {i.payerName}{i.claimNumber ? ` · Claim ${i.claimNumber}` : ""}</div>)}
              {p.insurances.length === 0 && <div className="text-sm text-slate-400">None on file yet.</div>}
            </div>
            <div className="card overflow-hidden">
              <div className="card-head"><div className="card-title">Billing status</div></div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500"><tr><th className="px-5 py-2 font-medium">Service date</th><th className="font-medium">Status</th><th className="text-right font-medium">Billed</th><th className="text-right font-medium">Paid</th><th className="px-5 text-right font-medium">Open</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {p.claims.map((c) => <tr key={c.id}><td className="px-5 py-2.5">{isoToDisplay(c.serviceDateFrom)}</td><td><Badge tone={c.status === "paid" ? "green" : c.status === "denied" ? "red" : "amber"}>{c.statusText}</Badge></td><td className="text-right"><Money cents={c.billedCents} /></td><td className="text-right"><Money cents={c.paidCents} /></td><td className="px-5 text-right font-medium"><Money cents={c.balanceCents} /></td></tr>)}
                  {p.claims.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">No claims yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card self-start p-5">
            <div className="card-title mb-3">Paperwork we need</div>
            <ChecklistCard checklist={p.checklist} />
          </div>
        </div>
      )}
    </Page>
  );
}

function PatientsList({ open }: { open: (id: number) => void }) {
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["portal", "patients", q], queryFn: () => get<P[]>(`/api/portal/client/patients?q=${encodeURIComponent(q)}`) });
  return (
    <Page title="Patients" subtitle="Your patients, their balances, and paperwork still needed.">
      <input className="input mb-4 max-w-sm" placeholder="Search by last name or account #…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={list.error} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500"><tr><th className="px-5 py-3 font-medium">Patient</th><th className="font-medium">Coverage</th><th className="font-medium">Claims</th><th className="font-medium">Missing docs</th><th className="px-5 text-right font-medium">Open balance</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.data?.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(p.id)}>
                <td className="px-5 py-3"><div className="font-medium text-slate-900">{p.lastName}, {p.firstName}</div><div className="text-xs text-slate-500">#{p.accountNumber} · DOB {isoToDisplay(p.dob)}</div></td>
                <td><CoverageBadge type={p.coverageType} /></td>
                <td className="text-slate-600">{p.claims}</td>
                <td>{p.missingDocuments ? <Badge tone="red">{p.missingDocuments} missing</Badge> : <Badge tone="green">All in</Badge>}</td>
                <td className="px-5 text-right font-medium"><Money cents={p.balanceCents} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.length === 0 && <EmptyState icon={<Users size={20} />} title="No patients found" />}
      </div>
    </Page>
  );
}

function SendPaperwork({ patientId }: { patientId: number | null }) {
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const list = useQuery({ queryKey: ["portal", "uploads"], queryFn: () => get<{ id: number; receivedAt: string; statusText: string; subject: string | null }[]>("/api/portal/client/uploads") });
  const up = useMutation({
    mutationFn: (files: File[]) => uploadFiles("/api/portal/client/uploads", files, { note, ...(patientId ? { patientId: String(patientId) } : {}) }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["portal"] }); toast("Sent to Caliber. Thank you!"); },
  });
  return (
    <Page title="Send paperwork" subtitle="Orders, prescriptions, delivery tickets, POs, authorizations, chart notes. Goes straight to Caliber's billing team, encrypted.">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          {patientId && <div className="mb-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-800">This upload will be linked to the patient you were viewing.</div>}
          <Field label="Note for the billing team (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. New order for knee brace, delivered 10/14" /></Field>
          <input ref={ref} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.length && up.mutate([...e.target.files])} />
          <button disabled={!can("portal.client.upload")} className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-10 text-sm text-slate-500 hover:border-navy-300 hover:text-navy-700 disabled:opacity-50" onClick={() => ref.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) up.mutate([...e.dataTransfer.files]); }}>
            {up.isPending ? <Loader2 className="animate-spin" /> : <Upload />} {up.isPending ? "Sending…" : "Drop files here or click to choose"}
            <span className="text-2xs text-slate-400">PDF or photos, up to 25 MB each</span>
          </button>
          <div className="mt-2"><ErrorBox error={up.error} /></div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">What you've sent</div></div>
          <ul className="divide-y divide-slate-50">
            {list.data?.map((u) => <li key={u.id} className="flex items-center gap-3 px-5 py-2.5 text-sm"><span className="flex-1 text-slate-700">{u.subject ?? "Paperwork"}</span><span className="text-xs text-slate-400">{new Date(u.receivedAt).toLocaleDateString()}</span><Badge tone={u.statusText === "Filed" ? "green" : "amber"}>{u.statusText}</Badge></li>)}
            {list.data?.length === 0 && <li className="px-5 py-6 text-sm text-slate-400">Nothing sent yet.</li>}
          </ul>
        </div>
      </div>
    </Page>
  );
}

function PortalUsers() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["portal", "users"], queryFn: () => get<{ id: number; email: string; name: string; role: string; roleLabel: string; active: boolean }[]>("/api/portal/client/users") });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: "", name: "", role: "client_user" });
  const [pw, setPw] = useState<string | null>(null);
  const add = useMutation({ mutationFn: () => post<{ temporaryPassword: string }>("/api/portal/client/users", f), onSuccess: (r) => { setAdding(false); setPw(r.temporaryPassword); qc.invalidateQueries({ queryKey: ["portal", "users"] }); } });
  const toggle = useMutation({ mutationFn: (u: { id: number; active: boolean }) => api("PATCH", `/api/portal/client/users/${u.id}`, { active: !u.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "users"] }) });
  return (
    <Page title="Your team's access" subtitle="People at your company who can sign in to this portal." actions={<button className="btn btn-primary" onClick={() => { setF({ email: "", name: "", role: "client_user" }); setAdding(true); }}><UserPlus size={15} /> Add a person</button>}>
      <ErrorBox error={q.error ?? toggle.error} />
      <div className="card divide-y divide-slate-100">
        {q.data?.map((u) => (
          <div key={u.id} className={`flex items-center gap-3 px-5 py-3 text-sm ${u.active ? "" : "opacity-50"}`}>
            <div className="flex-1"><div className="font-medium text-slate-900">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></div>
            <span className="text-slate-600">{u.roleLabel}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle.mutate(u)}>{u.active ? "Turn off" : "Turn on"}</button>
          </div>
        ))}
      </div>
      {adding && (
        <Modal title="Add a person" onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <Field label="Email" required><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Access"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="client_user">Can view and send paperwork</option><option value="client_admin">Admin: also manages people</option></select></Field>
            <ErrorBox error={add.error} />
          </div>
          <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={!f.email || !f.name} onClick={() => add.mutate()}>Add</button></div>
        </Modal>
      )}
      {pw && (
        <Modal title="Temporary password" subtitle="Shown once. Share it privately; they'll choose their own at first sign-in." onClose={() => setPw(null)}>
          <div className="select-all rounded-lg bg-slate-50 p-4 font-mono text-lg">{pw}</div>
          <div className="mt-4 flex justify-end"><button className="btn btn-primary" onClick={() => setPw(null)}>Done</button></div>
        </Modal>
      )}
    </Page>
  );
}

export function ClientPortal() {
  const { can, activeClient } = useSession();
  const [tab, setTab] = useState<Tab>("home");
  const [patient, setPatient] = useState<number | null>(null);
  const [sendFor, setSendFor] = useState<number | null>(null);
  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: "Dashboard" },
    { key: "patients", label: "Patients" },
    { key: "send", label: "Send paperwork" },
    ...(can("report.view") ? [{ key: "reports" as Tab, label: "Reports" }] : []),
    ...(can("portal.client.users") ? [{ key: "users" as Tab, label: "Users" }] : []),
  ];
  const go = (t: Tab) => { setTab(t); setPatient(null); if (t !== "send") setSendFor(null); };
  return (
    <PortalFrame title={`${activeClient?.name ?? "Client"} portal`} tabs={tabs} tab={tab} onTab={go}>
      {tab === "home" && <Dashboard go={go} />}
      {tab === "patients" && (patient ? <PatientDetail id={patient} back={() => setPatient(null)} send={(id) => { setSendFor(id); setTab("send"); setPatient(null); }} /> : <PatientsList open={setPatient} />)}
      {tab === "send" && <SendPaperwork patientId={sendFor} />}
      {tab === "reports" && <Reports portal />}
      {tab === "users" && <PortalUsers />}
    </PortalFrame>
  );
}
