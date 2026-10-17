// The Inbox: faxes, emails and uploads land here. The reader fills in what it can; a person checks every
// value against the paper, decides "new patient" or "existing patient", and files it.
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, FileText, Inbox, Loader2, Mail, Printer, RefreshCw, Sparkles, Upload, UserCheck, UserPlus, XCircle } from "lucide-react";
import { ApiError, get, post, uploadFiles } from "@/lib/api";
import { useNav } from "@/lib/nav";
import { useSession } from "@/lib/session";
import type { Doc, Payer } from "@/lib/types";
import { Page } from "@/components/Shell";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Modal, Select } from "@/components/inputs";
import { DocumentViewer } from "@/components/DocumentViewer";
import { DOC_TYPES, type Extraction, type ExtractedField } from "@shared/documents";
import { PAYER_TYPES } from "@shared/picklists";
import { isoToDisplay } from "@shared/dates";

type Row = { id: number; source: string; sender: string | null; subject: string | null; receivedAt: string; status: string; reader: string | null; decision: string | null; patientId: number | null; completedAt: string | null; completedBy: string | null; docCount: number; foundName: string | null };
type Match = { patientId: number; accountNumber: string; lastName: string; firstName: string; dob: string; score: number; reasons: string[] };
type Item = Row & { extraction: Extraction | null; readerError: string | null; suggestedPatientId: number | null; documents: Doc[]; matches: Match[] };

const SOURCE: Record<string, { label: string; icon: ReactElement }> = {
  fax: { label: "Fax", icon: <Printer size={15} /> },
  email: { label: "Email", icon: <Mail size={15} /> },
  upload: { label: "Upload", icon: <Upload size={15} /> },
  client_portal: { label: "Client portal", icon: <Upload size={15} /> },
  patient_portal: { label: "Patient portal", icon: <Upload size={15} /> },
  api: { label: "API", icon: <Bot size={15} /> },
};
const READER: Record<string, string> = { claude: "AI reader", demo: "Demo reader", manual: "Typed by hand" };

export function InboxScreen() {
  const { aiReader, aiReaderNote } = useSession();
  const nav = useNav();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [source, setSource] = useState("upload");
  const [sender, setSender] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useQuery({ queryKey: ["intake", tab], queryFn: () => get<Row[]>(`/api/intake${tab === "done" ? "?status=done" : ""}`), refetchInterval: (q) => (q.state.data?.some((r) => r.status === "reading") ? 2000 : false) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["intake"] });
  const up = useMutation({
    mutationFn: (files: File[]) => uploadFiles<{ id: number }>("/api/intake", files, { source, sender }),
    onSuccess: (r) => { refresh(); toast("Received. Reading it now…"); nav.go({ name: "intake", id: r.id }); },
  });
  const demo = useMutation({ mutationFn: (kind: "new" | "existing") => post<{ id: number }>("/api/intake/demo", { kind }), onSuccess: () => { refresh(); toast("A sample just arrived in the Inbox."); } });

  return (
    <Page
      title="Inbox"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          New paperwork from fax, email, the portals and the API. Open each one, check what was read, and file it to a patient.
          <Badge tone={aiReader === "on" ? "green" : "slate"}><Bot size={11} /> {aiReaderNote}</Badge>
        </span>
      }
      actions={
        <>
          <button className="btn btn-sm" onClick={() => demo.mutate("new")} title="Practice with fake paperwork"><Sparkles size={14} /> Sample: new patient fax</button>
          <button className="btn btn-sm" onClick={() => demo.mutate("existing")}><Sparkles size={14} /> Sample: existing patient email</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-slate-100 px-3">
            {(["open", "done"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`relative px-3 py-3 text-sm font-medium ${tab === t ? "text-navy-800" : "text-slate-500 hover:text-slate-800"}`}>
                {t === "open" ? "To file" : "Filed"}
                {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-800" />}
              </button>
            ))}
          </div>
          {list.data?.length === 0 && <EmptyState icon={<Inbox size={20} />} title={tab === "open" ? "Inbox is clear" : "Nothing filed yet"} body={tab === "open" ? "New faxes and emails show up here by themselves." : undefined} />}
          <ul className="divide-y divide-slate-50">
            {list.data?.map((r) => (
              <li key={r.id}>
                <button className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50" onClick={() => (r.status === "done" && r.patientId ? nav.openPatient(r.patientId, r.foundName ?? "Patient", "documents") : nav.go({ name: "intake", id: r.id }))}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{SOURCE[r.source]?.icon ?? <FileText size={15} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{r.foundName ?? "Name not read yet"}</span>
                      {r.status === "reading" && <Badge tone="navy"><Loader2 size={11} className="animate-spin" /> Reading</Badge>}
                      {r.status === "review" && <Badge tone="amber">Needs review</Badge>}
                      {r.status === "done" && <Badge tone="green">{r.decision === "new" ? "New patient" : "Existing patient"}</Badge>}
                      {r.status === "rejected" && <Badge tone="red">Not filed</Badge>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {SOURCE[r.source]?.label ?? r.source}{r.sender ? ` · ${r.sender}` : ""}{r.subject ? ` · ${r.subject}` : ""} · {r.docCount} file{r.docCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-right text-xs text-slate-400">
                    {new Date(r.receivedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {r.completedBy && <span className="block">by {r.completedBy}</span>}
                  </span>
                  <ArrowRight size={15} className="text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card self-start p-4">
          <div className="card-title mb-1">Add paperwork</div>
          <p className="mb-3 text-xs text-slate-500">Scanned or saved files. Several files can be one packet (Rx, delivery ticket, PO…).</p>
          <div className="space-y-2">
            <Select value={source} onChange={setSource} options={[{ code: "upload", label: "Scanned / uploaded" }, { code: "fax", label: "Came by fax" }, { code: "email", label: "Came by email" }]} />
            <input className="input" placeholder="From (fax number, email, clinic)…" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={120} />
          </div>
          <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.length && up.mutate([...e.target.files])} />
          <button
            className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-500 hover:border-navy-300 hover:text-navy-700"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) up.mutate([...e.dataTransfer.files]); }}
          >
            {up.isPending ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {up.isPending ? "Uploading…" : "Drop files or click to choose"}
            <span className="text-2xs text-slate-400">PDF or image, up to 25 MB each</span>
          </button>
          <div className="mt-2"><ErrorBox error={up.error ?? demo.error} /></div>
        </div>
      </div>
    </Page>
  );
}

// ---- Review one item -------------------------------------------------------------------

const PATIENT_FIELDS: { key: keyof Extraction["patient"]; label: string; span?: string; required?: boolean }[] = [
  { key: "lastName", label: "Last name", required: true },
  { key: "firstName", label: "First name", required: true },
  { key: "middleInitial", label: "MI", span: "col-span-1" },
  { key: "dob", label: "Date of birth (YYYY-MM-DD)", required: true },
  { key: "sex", label: "Sex (F/M/U)", required: true },
  { key: "ssn", label: "SSN" },
  { key: "address1", label: "Address", span: "col-span-2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "phone", label: "Phone" },
  { key: "cellPhone", label: "Cell" },
  { key: "email", label: "Email" },
  { key: "employer", label: "Employer" },
];
const INS_FIELDS = [
  ["claimNumber", "Claim #"], ["memberId", "Member ID"], ["groupNumber", "Group #"], ["dateOfInjury", "Date of injury (YYYY-MM-DD)"],
  ["employerName", "Employer"], ["adjusterName", "Adjuster"], ["adjusterPhone", "Adjuster phone"], ["referralNumber", "VA referral #"], ["authorizationNumber", "Authorization #"],
] as const;
type InsKey = (typeof INS_FIELDS)[number][0];
type InsForm = { rank: number; payerId: number; payerGuess: string; values: Record<InsKey, string>; conf: Record<string, string> };

const confRing = (c?: string) => (c === "low" ? "border-red-300 bg-red-50/40" : c === "medium" ? "border-amber-300 bg-amber-50/40" : "");

function guessPayer(payers: Payer[], name: string | null, type: string) {
  const n = (name ?? "").toLowerCase();
  const byName = n ? payers.find((p) => p.name.toLowerCase() === n) ?? payers.find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n)) : undefined;
  return byName ?? payers.find((p) => p.payerType === type);
}

export function IntakeReview({ id }: { id: number }) {
  const nav = useNav();
  const qc = useQueryClient();
  const toast = useToast();
  const { aiReader, aiReaderNote } = useSession();
  const q = useQuery({ queryKey: ["intake", "item", id], queryFn: () => get<Item>(`/api/intake/${id}`), refetchInterval: (x) => (x.state.data?.status === "reading" ? 1500 : false) });
  const payers = useQuery({ queryKey: ["payers"], queryFn: () => get<Payer[]>("/api/payers"), staleTime: 300_000 });
  const item = q.data;

  const [docIdx, setDocIdx] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conf, setConf] = useState<Record<string, string>>({});
  const [ins, setIns] = useState<InsForm[]>([]);
  const [coverage, setCoverage] = useState("WC");
  const [docs, setDocs] = useState<Record<number, { docType: string; verified: boolean }>>({});
  const [decision, setDecision] = useState<"new" | "existing" | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [applyUpdates, setApplyUpdates] = useState(false);
  const [notDup, setNotDup] = useState(false);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form once from what the reader found (again if it is re-read).
  useEffect(() => {
    if (!item || item.status === "reading" || !payers.data) return;
    const stamp = `${item.id}:${item.reader}:${JSON.stringify(item.extraction)?.length}`;
    if (loadedFor === stamp) return;
    setLoadedFor(stamp);
    const e = item.extraction;
    const f: Record<string, string> = {};
    const c: Record<string, string> = {};
    if (e) for (const k of PATIENT_FIELDS) { const v = e.patient[k.key] as ExtractedField; f[k.key] = v.value ?? ""; c[k.key] = v.value ? v.confidence : ""; }
    setFields(f);
    setConf(c);
    setIns((e?.insurances ?? []).map((i) => {
      const values = Object.fromEntries(INS_FIELDS.map(([k]) => [k, (i[k] as ExtractedField).value ?? ""])) as Record<InsKey, string>;
      const cc = Object.fromEntries(INS_FIELDS.map(([k]) => [k, (i[k] as ExtractedField).value ? (i[k] as ExtractedField).confidence : ""]));
      return { rank: i.rank, payerId: guessPayer(payers.data, i.payerName.value, i.payerTypeGuess)?.id ?? 0, payerGuess: i.payerName.value ?? "", values, conf: { ...cc, payer: i.payerName.confidence } };
    }));
    const t = e?.insurances[0]?.payerTypeGuess;
    if (t && t !== "UNKNOWN") setCoverage(t);
    setDocs(Object.fromEntries(item.documents.map((d) => [d.id, { docType: d.docType, verified: !!d.verifiedAt }])));
    const top = item.matches[0];
    if (top && top.score >= 80) { setDecision("existing"); setPick(top.patientId); }
    else if (top) { setDecision(null); setPick(null); }
    else setDecision("new");
  }, [item, payers.data, loadedFor]);

  const allVerified = item ? item.documents.every((d) => docs[d.id]?.verified) : false;
  const patientPayload = useMemo(() => {
    const p: Record<string, unknown> = { coverageType: coverage };
    for (const k of PATIENT_FIELDS) if (fields[k.key]?.trim()) p[k.key] = fields[k.key].trim();
    if (p.sex) p.sex = String(p.sex).toUpperCase().slice(0, 1);
    if (p.state) p.state = String(p.state).toUpperCase().slice(0, 2);
    p.insurances = ins.filter((i) => i.payerId).map((i) => {
      const o: Record<string, unknown> = { rank: i.rank, payerId: i.payerId, relationshipToInsured: "18", subscriberLastName: p.lastName, subscriberFirstName: p.firstName, subscriberDob: p.dob, subscriberSex: p.sex };
      for (const [k] of INS_FIELDS) if (i.values[k]?.trim()) o[k] = i.values[k].trim();
      return o;
    });
    return p;
  }, [fields, ins, coverage]);

  const complete = useMutation({
    mutationFn: () =>
      post<{ patientId: number }>(`/api/intake/${id}/complete`, {
        decision,
        patientId: decision === "existing" ? pick ?? undefined : undefined,
        patient: decision === "new" || applyUpdates ? patientPayload : undefined,
        applyUpdates: decision === "existing" && applyUpdates,
        confirmNotDuplicate: notDup,
        documents: item!.documents.map((d) => ({ id: d.id, docType: docs[d.id]?.docType ?? d.docType, verified: !!docs[d.id]?.verified })),
        note: note.trim() || undefined,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["intake"] });
      toast(decision === "new" ? "New patient created and paperwork filed." : "Paperwork filed to the patient.");
      const label = decision === "existing" ? (() => { const m = item!.matches.find((x) => x.patientId === pick); return m ? `${m.lastName}, ${m.firstName}` : "Patient"; })() : `${fields.lastName}, ${fields.firstName}`;
      nav.openPatient(r.patientId, label, "overview");
    },
  });
  const reject = useMutation({ mutationFn: () => post(`/api/intake/${id}/reject`, { reason }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["intake"] }); toast("Marked as not filed."); nav.go({ name: "inbox" }); } });
  const reread = useMutation({ mutationFn: () => post(`/api/intake/${id}/reread`), onSuccess: () => { setLoadedFor(null); q.refetch(); } });

  if (q.isLoading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!item) return <div className="p-10"><ErrorBox error={q.error} /></div>;
  const handled = item.status === "done" || item.status === "rejected";
  const current = item.documents[docIdx] ?? item.documents[0];
  const isDupError = complete.error instanceof ApiError && complete.error.status === 409 && decision === "new";
  const missingRequired = decision === "new" || applyUpdates ? PATIENT_FIELDS.filter((f) => f.required && !fields[f.key]?.trim()).map((f) => f.label) : [];
  const canFile = !handled && decision && (decision === "new" || pick) && missingRequired.length === 0;

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col xl:flex-row">
      {/* The paper, on the left */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 bg-slate-100/70 p-4 xl:max-w-[52%]">
        <div className="mb-3 flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => nav.go({ name: "inbox" })}>← Inbox</button>
          <span className="text-sm text-slate-600">{SOURCE[item.source]?.label}{item.sender ? ` · ${item.sender}` : ""}</span>
          <span className="ml-auto text-xs text-slate-400">{new Date(item.receivedAt).toLocaleString()}</span>
        </div>
        {item.documents.length > 1 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {item.documents.map((d, i) => (
              <button key={d.id} onClick={() => setDocIdx(i)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${i === docIdx ? "bg-navy-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {docs[d.id]?.verified ? <CheckCircle2 size={12} /> : <FileText size={12} />} File {i + 1}
              </button>
            ))}
          </div>
        )}
        {current && <DocumentViewer documentId={current.id} mimeType={current.mimeType} height="calc(100vh - 150px)" />}
      </div>

      {/* The review, on the right */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {item.status === "reading" ? (
          <div className="card flex items-center gap-3 p-6 text-slate-600"><Loader2 className="animate-spin text-navy-600" /> Reading the paperwork… This page fills in by itself.</div>
        ) : (
          <div className="space-y-5">
            <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${item.reader === "manual" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-navy-100 bg-navy-50/60 text-navy-900"}`}>
              {item.reader === "manual" ? <AlertTriangle size={18} className="shrink-0" /> : <Bot size={18} className="shrink-0" />}
              <div className="flex-1">
                <div className="font-medium">{READER[item.reader ?? "manual"]}{item.reader !== "claude" && aiReader === "off" ? ` (${aiReaderNote})` : ""}</div>
                <div className="mt-0.5 text-xs opacity-80">
                  {item.reader === "manual" ? "Type the details from the paper on the left." : "Check every value against the paper. Red = the reader wasn't sure. Amber = fairly sure. Nothing is saved until you file it."}
                  {item.extraction?.readerNotes ? ` Reader notes: ${item.extraction.readerNotes}` : ""}
                  {item.readerError ? ` ${item.readerError}` : ""}
                </div>
              </div>
              {!handled && <button className="btn btn-ghost btn-sm" onClick={() => reread.mutate()} title="Read again"><RefreshCw size={14} /></button>}
            </div>

            {handled && <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">This paperwork was {item.status === "done" ? `filed by ${item.completedBy}` : `set aside by ${item.completedBy}`}.</div>}

            {/* 1. New or existing? */}
            <section className="card p-5">
              <div className="mb-3 font-semibold text-slate-900">1. Is this a new patient or one we already have?</div>
              {item.matches.length > 0 ? (
                <div className="space-y-2">
                  {item.matches.map((m) => (
                    <label key={m.patientId} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "existing" && pick === m.patientId ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" checked={decision === "existing" && pick === m.patientId} onChange={() => { setDecision("existing"); setPick(m.patientId); }} disabled={handled} />
                      <UserCheck size={16} className="text-navy-600" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-900">{m.lastName}, {m.firstName}</span>
                        <span className="ml-2 text-xs text-slate-500">#{m.accountNumber} · DOB {isoToDisplay(m.dob)}</span>
                        <span className="block text-2xs text-slate-500">{m.reasons.join(" · ")}</span>
                      </span>
                      <Badge tone={m.score >= 80 ? "green" : m.score >= 60 ? "amber" : "slate"}>{m.score >= 80 ? "Strong match" : m.score >= 60 ? "Possible" : "Weak"}</Badge>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mb-2 text-sm text-slate-500">No one in this client matches the name, date of birth, SSN, phone or claim number.</div>
              )}
              <label className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "new" ? "border-accent-400 bg-accent-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" checked={decision === "new"} onChange={() => { setDecision("new"); setPick(null); }} disabled={handled} />
                <UserPlus size={16} className="text-accent-700" />
                <span className="font-medium text-slate-900">New patient: create a new account</span>
              </label>
              {decision === "existing" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={applyUpdates} onChange={(e) => setApplyUpdates(e.target.checked)} disabled={handled} />
                  Also update this patient's file with the details below (filled-in values replace what's on file)
                </label>
              )}
            </section>

            {/* 2. Patient details */}
            {(decision === "new" || applyUpdates) && (
              <section className="card p-5">
                <div className="mb-3 font-semibold text-slate-900">2. Patient details</div>
                <div className="grid grid-cols-3 gap-3">
                  {PATIENT_FIELDS.map((f) => (
                    <label key={f.key} className={`field ${f.span ?? ""}`}>
                      <span className="label">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                      <input className={`input ${confRing(conf[f.key])}`} value={fields[f.key] ?? ""} disabled={handled} onChange={(e) => { setFields((x) => ({ ...x, [f.key]: e.target.value })); setConf((c) => ({ ...c, [f.key]: "" })); }} />
                    </label>
                  ))}
                  <label className="field">
                    <span className="label">Main coverage <span className="text-red-500">*</span></span>
                    <Select value={coverage} onChange={setCoverage} options={PAYER_TYPES} disabled={handled} />
                  </label>
                </div>

                <div className="mt-5 mb-2 text-sm font-semibold text-slate-800">Insurance</div>
                {ins.length === 0 && <div className="text-sm text-slate-400">No insurance was read. Add it now or later on the patient's file.</div>}
                {ins.map((i, n) => (
                  <div key={i.rank} className="mb-3 rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 grid grid-cols-3 gap-3">
                      <label className="field col-span-2">
                        <span className="label">{["Primary", "Secondary", "Tertiary"][i.rank - 1]} payer{i.payerGuess ? ` (paper says “${i.payerGuess}”)` : ""}</span>
                        <select className={`input ${!i.payerId ? "border-red-300" : confRing(i.conf.payer)}`} value={i.payerId || ""} disabled={handled} onChange={(e) => setIns((x) => x.map((y, m) => (m === n ? { ...y, payerId: Number(e.target.value) } : y)))}>
                          <option value="">Choose the payer…</option>
                          {payers.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {INS_FIELDS.map(([k, label]) => (
                        <label key={k} className="field">
                          <span className="label">{label}</span>
                          <input className={`input ${confRing(i.conf[k])}`} value={i.values[k]} disabled={handled} onChange={(e) => setIns((x) => x.map((y, m) => (m === n ? { ...y, values: { ...y.values, [k]: e.target.value }, conf: { ...y.conf, [k]: "" } } : y)))} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {!handled && ins.length < 3 && (
                  <button className="btn btn-sm" onClick={() => setIns((x) => [...x, { rank: x.length + 1, payerId: 0, payerGuess: "", values: Object.fromEntries(INS_FIELDS.map(([k]) => [k, ""])) as Record<InsKey, string>, conf: {} }])}>+ Add insurance</button>
                )}
                {(item.extraction?.diagnosisCodes.length || item.extraction?.hcpcsCodes.length || item.extraction?.orderingPhysician.value) ? (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-1 font-medium text-slate-700">Also read (use when posting charges)</div>
                    {item.extraction?.orderingPhysician.value && <div>Ordering physician: {item.extraction.orderingPhysician.value}</div>}
                    {!!item.extraction?.diagnosisCodes.length && <div>Diagnosis codes: <span className="font-mono">{item.extraction.diagnosisCodes.join(", ")}</span></div>}
                    {!!item.extraction?.hcpcsCodes.length && <div>HCPCS: <span className="font-mono">{item.extraction.hcpcsCodes.join(", ")}</span></div>}
                  </div>
                ) : null}
              </section>
            )}

            {/* 3. Documents */}
            <section className="card p-5">
              <div className="mb-1 font-semibold text-slate-900">{decision === "new" || applyUpdates ? "3" : "2"}. What's in the packet?</div>
              <p className="mb-3 text-xs text-slate-500">Check each file's type. Tick “verified” only when it's the right document, complete and readable. Verified documents count toward the ready-to-bill checklist.</p>
              <div className="space-y-2">
                {item.documents.map((d, i) => (
                  <div key={d.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-2.5 ${i === docIdx ? "border-navy-300" : "border-slate-200"}`}>
                    <button className="text-xs font-medium text-navy-700 hover:underline" onClick={() => setDocIdx(i)}>File {i + 1}</button>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{d.originalName}{item.extraction?.documents.find((x) => x.index === i)?.summary ? ` · ${item.extraction.documents.find((x) => x.index === i)!.summary}` : ""}</span>
                    <div className="w-64">
                      <Select value={docs[d.id]?.docType ?? d.docType} onChange={(v) => setDocs((x) => ({ ...x, [d.id]: { ...x[d.id], docType: v } }))} options={DOC_TYPES} disabled={handled} />
                    </div>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={!!docs[d.id]?.verified} disabled={handled} onChange={(e) => setDocs((x) => ({ ...x, [d.id]: { ...x[d.id], verified: e.target.checked } }))} /> Verified
                    </label>
                  </div>
                ))}
              </div>
            </section>

            {!handled && (
              <section className="card p-5">
                <textarea className="input h-16 resize-none py-2" placeholder="Optional note for the account (saved with the intake note)…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                {isDupError && (
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <input type="checkbox" className="mt-0.5" checked={notDup} onChange={(e) => setNotDup(e.target.checked)} />
                    I checked: this is a different person, not the existing patient. Create a new account anyway.
                  </label>
                )}
                <div className="mt-3"><ErrorBox error={complete.error} /></div>
                {missingRequired.length > 0 && <div className="mt-2 text-xs text-red-600">Still needed: {missingRequired.join(", ")}</div>}
                {!allVerified && <div className="mt-2 text-xs text-amber-700">Some files aren't verified yet. You can still file them; they'll show as “needs check” on the patient's checklist.</div>}
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn btn-ghost" onClick={() => setRejecting(true)}><XCircle size={15} /> Not patient paperwork</button>
                  <button className="btn btn-primary ml-auto" disabled={!canFile || complete.isPending} onClick={() => complete.mutate()}>
                    {decision === "new" ? <><UserPlus size={15} /> Create patient & file</> : <><UserCheck size={15} /> File to this patient</>}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {rejecting && (
        <Modal title="Set this paperwork aside" subtitle="It stays in the Filed list. Nothing is deleted." onClose={() => setRejecting(false)}>
          <input className="input" autoFocus placeholder="Why? (e.g. junk fax, wrong client, duplicate)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2"><ErrorBox error={reject.error} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={reason.trim().length < 3} onClick={() => reject.mutate()}>Set aside</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
