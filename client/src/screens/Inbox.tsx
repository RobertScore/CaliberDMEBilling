// The Inbox: faxes, emails and uploads land here. The reader fills in what it can; a person checks every
// value against the paper, decides "new patient" or "existing patient", and files it.
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, Search, CheckCircle2, FileText, Inbox, Loader2, Mail, Printer, RefreshCw, Sparkles, Upload, UserCheck, UserPlus, XCircle } from "lucide-react";
import { ApiError, get, post, uploadFiles } from "@/lib/api";
import { useNav } from "@/lib/nav";
import { useSession } from "@/lib/session";
import type { Doc, Payer } from "@/lib/types";
import { Page } from "@/components/Shell";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Modal, Select } from "@/components/inputs";
import { PageViewer, type Focus } from "@/components/PageViewer";
import { AiField, originOf } from "@/components/AiField";
import { PacketParts, checkParts, initialParts, splittable, type Part } from "@/components/PacketParts";
import type { Extraction, ExtractedField } from "@shared/documents";
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
type InsForm = { rank: number; payerId: number; payerGuess: string; values: Record<InsKey, string>; ai: Partial<Record<InsKey | "payer", ExtractedField>> };


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
  const [aiP, setAiP] = useState<Record<string, ExtractedField>>({}); // what the AI read for each patient field
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // AI values a person confirmed ("p.lastName", "i0.claimNumber")
  const [focus, setFocus] = useState<Focus | null>(null);
  const [ins, setIns] = useState<InsForm[]>([]);
  const [coverage, setCoverage] = useState("WC");
  const [parts, setParts] = useState<Record<number, Part[]>>({});
  const [slots, setSlots] = useState<Record<number, string>>({}); // existing patient: where each read insurance goes
  const [chosen, setChosen] = useState<{ id: number; label: string } | null>(null); // picked by search, not suggested
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
    const a: Record<string, ExtractedField> = {};
    if (e) for (const k of PATIENT_FIELDS) { const v = e.patient[k.key] as ExtractedField; f[k.key] = v.value ?? ""; if (v.value) a[k.key] = v; }
    setFields(f);
    setAiP(a);
    setChecked({});
    setFocus(null);
    setIns((e?.insurances ?? []).map((i) => {
      const values = Object.fromEntries(INS_FIELDS.map(([k]) => [k, (i[k] as ExtractedField).value ?? ""])) as Record<InsKey, string>;
      const ai = Object.fromEntries(INS_FIELDS.filter(([k]) => (i[k] as ExtractedField).value).map(([k]) => [k, i[k] as ExtractedField]));
      const payerId = guessPayer(payers.data, i.payerName.value, i.payerTypeGuess)?.id ?? 0;
      return { rank: i.rank, payerId, payerGuess: i.payerName.value ?? "", values, ai: { ...ai, ...(i.payerName.value && payerId ? { payer: { ...i.payerName, value: String(payerId) } } : {}) } };
    }));
    const t = e?.insurances[0]?.payerTypeGuess;
    if (t && t !== "UNKNOWN") setCoverage(t);
    setParts(Object.fromEntries(item.documents.map((d, i) => [d.id, initialParts(d, i, e)])));
    setSlots({});
    const top = item.matches[0];
    if (top && top.score >= 80) { setDecision("existing"); setPick(top.patientId); }
    else if (top) { setDecision(null); setPick(null); }
    else setDecision("new");
  }, [item, payers.data, loadedFor]);

  // Existing patient: what's on file now, so the reviewer can choose where each insurance / claim goes.
  const existing = useQuery({
    queryKey: ["patient", pick],
    queryFn: () => get<{ firstName: string; lastName: string; dob: string; sex: string; insurances: { rank: number; payerName: string; payerType: string; claimNumber: string | null; referralNumber: string | null; authorizationNumber: string | null }[] }>(`/api/patients/${pick}`),
    enabled: decision === "existing" && !!pick,
  });
  const onFile = existing.data?.insurances ?? [];
  const norm = (v?: string | null) => (v ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const defaultSlot = (i: InsForm, n: number) => {
    const same = onFile.find((f) => (norm(i.values.claimNumber) && norm(f.claimNumber) === norm(i.values.claimNumber)) || (norm(i.values.referralNumber) && norm(f.referralNumber) === norm(i.values.referralNumber)));
    if (same) return `update:${same.rank}`;
    const taken = new Set([...onFile.map((f) => f.rank), ...ins.slice(0, n).map((x, k) => Number((slots[k] ?? "").split(":")[1]) || 0)]);
    const free = [1, 2, 3].find((r) => !taken.has(r));
    return free ? `add:${free}` : "skip";
  };
  const slotOf = (n: number) => slots[n] ?? defaultSlot(ins[n], n);
  const planned = ins.map((i, n) => ({ i, n, slot: slotOf(n) })).filter((x) => x.slot !== "skip");
  const slotClash = new Set(planned.map((x) => x.slot.split(":")[1])).size !== planned.length;

  const fileParts = item ? item.documents.flatMap((d) => (parts[d.id] ?? []).filter((p) => !p.skip)) : [];
  const allVerified = fileParts.every((p) => p.verified);
  const partErrors = item ? item.documents.flatMap((d) => (splittable(d) ? checkParts(d, parts[d.id] ?? []).errors : [])) : [];
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

  /** Existing patient: only the insurances going into chosen slots, plus the details if "also update" is ticked. */
  function existingPayload() {
    const { insurances: _ignored, coverageType: _c, ...details } = patientPayload as Record<string, unknown>;
    const who = existing.data;
    const insurances = planned.map(({ i, slot }) => {
      const [mode, rank] = slot.split(":");
      const o: Record<string, unknown> = { rank: Number(rank), payerId: i.payerId, relationshipToInsured: "18" };
      if (mode !== "update" && who) Object.assign(o, { subscriberLastName: who.lastName, subscriberFirstName: who.firstName, subscriberDob: who.dob, subscriberSex: who.sex });
      for (const [k] of INS_FIELDS) if (i.values[k]?.trim()) o[k] = i.values[k].trim();
      return o;
    });
    return { ...(applyUpdates ? details : {}), insurances };
  }

  const complete = useMutation({
    mutationFn: () =>
      post<{ patientId: number }>(`/api/intake/${id}/complete`, {
        decision,
        patientId: decision === "existing" ? pick ?? undefined : undefined,
        patient: decision === "new" ? patientPayload : existingPayload(),
        applyUpdates: decision === "existing" && applyUpdates,
        replaceRanks: decision === "existing" ? planned.filter((x) => x.slot.startsWith("replace")).map((x) => Number(x.slot.split(":")[1])) : [],
        confirmNotDuplicate: notDup,
        documents: item!.documents.map((d) => {
          const ps = parts[d.id] ?? [];
          if (splittable(d)) return { id: d.id, docType: ps[0]?.docType ?? "other", verified: false, sections: ps.map(({ fromPage, toPage, docType, verified, skip }) => ({ fromPage, toPage, docType, verified, skip })) };
          return { id: d.id, docType: ps[0]?.docType ?? d.docType, verified: !!ps[0]?.verified };
        }),
        note: note.trim() || undefined,
        fieldReview: fieldReview(),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["intake"] });
      toast(decision === "new" ? "New patient created and paperwork filed." : "Paperwork filed to the patient.");
      const label = decision === "existing" ? (() => { const m = item!.matches.find((x) => x.patientId === pick); return m ? `${m.lastName}, ${m.firstName}` : chosen?.label ?? "Patient"; })() : `${fields.lastName}, ${fields.firstName}`;
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
  const missingRequired = decision === "new" ? PATIENT_FIELDS.filter((f) => f.required && !fields[f.key]?.trim()).map((f) => f.label) : [];
  const insProblems = decision === "existing" ? [...(slotClash ? ["Two insurances are going into the same slot."] : []), ...(planned.some((x) => !x.i.payerId) ? ["Choose the payer for each insurance you're saving."] : [])] : [];
  const canFile = !handled && decision && (decision === "new" || pick) && missingRequired.length === 0 && partErrors.length === 0 && insProblems.length === 0;
  let step = 1;
  // ---- AI-read fields: where each came from, checking them one by one -----------------------------
  const labelOf = (key: string) => {
    const [scope, k] = key.split(".");
    if (scope === "p") return PATIENT_FIELDS.find((f) => f.key === k)?.label ?? k;
    return k === "payer" ? "Payer" : INS_FIELDS.find(([x]) => x === k)?.[1] ?? k;
  };
  /** Jump the document to where the AI read this value, and highlight it. */
  function locate(key: string, ai?: ExtractedField) {
    const w = ai?.where;
    if (!w || !item) return;
    if (w.file >= 0 && w.file < item.documents.length) setDocIdx(w.file);
    setFocus({ page: Math.max(1, w.page), box: w.box && w.box.w > 0 && w.box.h > 0 ? w.box : null, label: `${labelOf(key)}${w.box ? "" : ` (page ${w.page})`}`, n: Date.now() });
  }
  // Every AI-read field currently on screen, in screen order.
  const showPatient = decision === "new" || applyUpdates;
  const showIns = (n: number) => decision === "new" || (decision === "existing" && !!pick && slotOf(n) !== "skip");
  const aiFields: { key: string; ai: ExtractedField; value: string }[] = [
    ...(showPatient ? PATIENT_FIELDS.filter((f) => aiP[f.key]).map((f) => ({ key: `p.${f.key}`, ai: aiP[f.key], value: fields[f.key] ?? "" })) : []),
    ...ins.flatMap((i, n) => (showIns(n) ? [
      ...(i.ai.payer ? [{ key: `i${n}.payer`, ai: i.ai.payer, value: String(i.payerId || "") }] : []),
      ...INS_FIELDS.filter(([k]) => i.ai[k]).map(([k]) => ({ key: `i${n}.${k}`, ai: i.ai[k]!, value: i.values[k] })),
    ] : [])),
  ];
  const tally = aiFields.reduce((t, f) => { t[originOf(f.value, f.ai, !!checked[f.key])]++; return t; }, { ai: 0, checked: 0, edited: 0, typed: 0, empty: 0 });
  /** Move to the next AI field that still needs checking. */
  function goNext(after?: string) {
    const start = after ? aiFields.findIndex((f) => f.key === after) + 1 : 0;
    const order = [...aiFields.slice(start), ...aiFields.slice(0, start)];
    const next = order.find((f) => f.key !== after && originOf(f.value, f.ai, !!checked[f.key]) === "ai");
    if (!next) return;
    const el = document.getElementById(`f-${next.key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
    locate(next.key, next.ai);
  }
  const fieldProps = (key: string, ai: ExtractedField | undefined, value: string, onChange: (v: string) => void) => ({
    id: `f-${key}`, value, ai, checked: !!checked[key], disabled: handled, onChange,
    onCheck: () => setChecked((c) => ({ ...c, [key]: true })),
    onUndo: () => ai?.value && onChange(ai.value),
    onLocate: () => locate(key, ai),
    onNext: () => goNext(key),
  });
  /** What happened to each AI value, saved with the filing so accuracy can be measured. */
  const fieldReview = () => aiFields.map((f) => ({ field: f.key, label: labelOf(f.key), aiValue: f.ai.value, finalValue: f.value || null, confidence: f.ai.confidence, outcome: originOf(f.value, f.ai, !!checked[f.key]) }));

  const setInsValue = (n: number, k: InsKey, v: string) => setIns((x) => x.map((y, m) => (m === n ? { ...y, values: { ...y.values, [k]: v } } : y)));
  const insCard = (i: InsForm, n: number, top?: ReactNode) => (
    <div key={n} className="mb-3 rounded-lg border border-slate-200 p-3">
      {top}
      <div className="mb-2 grid grid-cols-3 gap-3">
        <AiField {...fieldProps(`i${n}.payer`, i.ai.payer, String(i.payerId || ""), (v) => setIns((x) => x.map((y, m) => (m === n ? { ...y, payerId: Number(v) } : y))))} aiText={i.payerGuess}
          label={`${decision === "new" ? `${["Primary", "Secondary", "Tertiary"][i.rank - 1]} payer` : "Payer"}${i.payerGuess ? ` (paper says “${i.payerGuess}”)` : ""}`} className="col-span-2">
          {({ id: fid, className, onFocus }) => (
            <select id={fid} className={`${className} ${!i.payerId ? "!border-red-300" : ""}`} value={i.payerId || ""} disabled={handled} onFocus={onFocus} onChange={(e) => setIns((x) => x.map((y, m) => (m === n ? { ...y, payerId: Number(e.target.value) } : y)))}>
              <option value="">Choose the payer…</option>
              {payers.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </AiField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {INS_FIELDS.map(([k, label]) => <AiField key={k} {...fieldProps(`i${n}.${k}`, i.ai[k], i.values[k], (v) => setInsValue(n, k, v))} label={label} />)}
      </div>
    </div>
  );

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
              <button key={d.id} onClick={() => { setDocIdx(i); setFocus(null); }} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${i === docIdx ? "bg-navy-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {(parts[d.id] ?? []).every((p) => p.skip || p.verified) ? <CheckCircle2 size={12} /> : <FileText size={12} />} File {i + 1}{d.pageCount && d.pageCount > 1 ? ` (${d.pageCount} pages)` : ""}
              </button>
            ))}
          </div>
        )}
        {current && <PageViewer documentId={current.id} mimeType={current.mimeType} focus={focus} />}
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

            {aiFields.length > 0 && !handled && (
              <div className="sticky top-0 z-10 rounded-xl border border-violet-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center gap-3">
                  <Sparkles size={16} className="text-violet-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {tally.checked + tally.edited} of {aiFields.length} AI values checked{tally.edited ? ` · ${tally.edited} corrected` : ""}
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="bg-emerald-500" style={{ width: `${(tally.checked / aiFields.length) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(tally.edited / aiFields.length) * 100}%` }} />
                    </div>
                  </div>
                  <button className="btn btn-sm border-violet-300 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50" disabled={tally.ai === 0} onClick={() => goNext()}>
                    {tally.ai === 0 ? "All checked" : `Check next (${tally.ai} left)`}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-slate-500">
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-violet-400 bg-violet-50" />AI, not checked yet</span>
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-emerald-400 bg-emerald-50" />AI, checked</span>
                  <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border-2 border-amber-400 bg-amber-50" />Corrected by you</span>
                  <span>Click a field to jump to where it was read · Enter = “it matches the paper”</span>
                </div>
              </div>
            )}

            {handled && <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">This paperwork was {item.status === "done" ? `filed by ${item.completedBy}` : `set aside by ${item.completedBy}`}.</div>}

            {/* 1. New or existing? */}
            <section className="card p-5">
              <div className="mb-3 font-semibold text-slate-900">{step++}. Is this a new patient or one we already have?</div>
              {item.matches.length > 0 ? (
                <div className="space-y-2">
                  {item.matches.map((m) => (
                    <label key={m.patientId} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "existing" && pick === m.patientId ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" checked={decision === "existing" && pick === m.patientId} onChange={() => { setDecision("existing"); setPick(m.patientId); setSlots({}); }} disabled={handled} />
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
              {chosen && !item.matches.some((m) => m.patientId === chosen.id) && (
                <label className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "existing" && pick === chosen.id ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" checked={decision === "existing" && pick === chosen.id} onChange={() => { setDecision("existing"); setPick(chosen.id); }} disabled={handled} />
                  <UserCheck size={16} className="text-navy-600" />
                  <span className="flex-1 font-medium text-slate-900">{chosen.label}</span>
                  <Badge tone="navy">Picked by you</Badge>
                </label>
              )}
              {!handled && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => nav.pickPatient("File this paperwork to…", (pid, label) => { setChosen({ id: pid, label }); setDecision("existing"); setPick(pid); setSlots({}); })}>
                  <Search size={14} /> Pick a different existing patient…
                </button>
              )}
              <label className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${decision === "new" ? "border-accent-400 bg-accent-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" checked={decision === "new"} onChange={() => { setDecision("new"); setPick(null); }} disabled={handled} />
                <UserPlus size={16} className="text-accent-700" />
                <span className="font-medium text-slate-900">New patient: create a new account</span>
              </label>
              {decision === "existing" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={applyUpdates} onChange={(e) => setApplyUpdates(e.target.checked)} disabled={handled} />
                  Also update this patient's name, address, phone and other details (filled-in values replace what's on file)
                </label>
              )}
            </section>

            {/* 2. Patient details */}
            {(decision === "new" || applyUpdates) && (
              <section className="card p-5">
                <div className="mb-3 font-semibold text-slate-900">{step++}. Patient details</div>
                <div className="grid grid-cols-3 gap-3">
                  {PATIENT_FIELDS.map((f) => (
                    <AiField key={f.key} {...fieldProps(`p.${f.key}`, aiP[f.key], fields[f.key] ?? "", (v) => setFields((x) => ({ ...x, [f.key]: v })))} label={f.label} required={f.required} className={f.span ?? ""} />
                  ))}
                  {decision === "new" && (
                    <label className="field">
                      <span className="label">Main coverage <span className="text-red-500">*</span></span>
                      <Select value={coverage} onChange={setCoverage} options={PAYER_TYPES} disabled={handled} />
                    </label>
                  )}
                </div>
                {decision === "new" && <>
                <div className="mt-5 mb-2 text-sm font-semibold text-slate-800">Insurance</div>
                {ins.length === 0 && <div className="text-sm text-slate-400">No insurance was read. Add it now or later on the patient's file.</div>}
                {ins.map((i, n) => insCard(i, n))}
                {!handled && ins.length < 3 && (
                  <button className="btn btn-sm" onClick={() => setIns((x) => [...x, { rank: x.length + 1, payerId: 0, payerGuess: "", values: Object.fromEntries(INS_FIELDS.map(([k]) => [k, ""])) as Record<InsKey, string>, ai: {} }])}>+ Add insurance</button>
                )}
                </>}
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

            {/* Existing patient: where each insurance / claim goes */}
            {decision === "existing" && pick && (
              <section className="card p-5">
                <div className="mb-1 font-semibold text-slate-900">{step++}. Insurance and claims</div>
                <p className="mb-3 text-xs text-slate-500">Choose where each insurance from the paperwork goes. "Add" puts a new claim in an empty slot (e.g. a second injury). "Update" adds new details, like a new authorization number, to a claim on file. "Replace" overwrites a slot completely.</p>
                <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="mb-1 font-medium text-slate-700">On file now</div>
                  {[1, 2, 3].map((r) => {
                    const f = onFile.find((x) => x.rank === r);
                    return <div key={r} className="text-slate-600">Slot {r}: {f ? `${f.payerName}${f.claimNumber ? ` · claim ${f.claimNumber}` : ""}${f.referralNumber ? ` · referral ${f.referralNumber}` : ""}${f.authorizationNumber ? ` · auth ${f.authorizationNumber}` : ""}` : <span className="text-slate-400">empty</span>}</div>;
                  })}
                </div>
                {ins.length === 0 && <div className="text-sm text-slate-400">No insurance was read from this paperwork.</div>}
                {ins.map((i, n) =>
                  insCard(i, n, (
                    <label className="field mb-2">
                      <span className="label">Where should this go?</span>
                      <select className="input" value={slotOf(n)} disabled={handled} onChange={(e) => setSlots((x) => ({ ...x, [n]: e.target.value }))}>
                        <option value="skip">Don't save this insurance</option>
                        {[1, 2, 3].map((r) => {
                          const f = onFile.find((x) => x.rank === r);
                          return f ? (
                            <optgroup key={r} label={`Slot ${r}: ${f.payerName}${f.claimNumber ? ` (claim ${f.claimNumber})` : ""}`}>
                              <option value={`update:${r}`}>Update slot {r} (same claim; keep what's on file)</option>
                              <option value={`replace:${r}`}>Replace slot {r} completely</option>
                            </optgroup>
                          ) : (
                            <option key={r} value={`add:${r}`}>Add as a new claim in empty slot {r}</option>
                          );
                        })}
                      </select>
                    </label>
                  )),
                )}
                {!handled && ins.length < 3 && (
                  <button className="btn btn-sm" onClick={() => setIns((x) => [...x, { rank: x.length + 1, payerId: 0, payerGuess: "", values: Object.fromEntries(INS_FIELDS.map(([k]) => [k, ""])) as Record<InsKey, string>, ai: {} }])}>+ Add insurance</button>
                )}
                {insProblems.map((m) => <div key={m} className="mt-2 text-xs text-red-600">{m}</div>)}
              </section>
            )}

            {/* Documents */}
            <section className="card p-5">
              <div className="mb-1 font-semibold text-slate-900">{step++}. What's in the packet?</div>
              <p className="mb-3 text-xs text-slate-500">
                Each part becomes its own document on the patient's file, so the ready-to-bill checklist can see it. Check the pages and type of each part; tick "Verified" only when it's the right document, complete and readable.
                Set aside anything that isn't for this patient (cover sheets, junk, someone else's page). The full packet is always kept with this Inbox item.
              </p>
              <div className="space-y-4">
                {item.documents.filter((d) => !d.parentDocumentId).map((d) => {
                  const i = item.documents.indexOf(d);
                  return (
                    <div key={d.id}>
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <button className={`font-medium ${i === docIdx ? "text-navy-800" : "text-navy-600 hover:underline"}`} onClick={() => { setDocIdx(i); setFocus(null); }}>File {i + 1}</button>
                        <span className="truncate text-slate-500">{d.originalName}{d.pageCount ? ` · ${d.pageCount} page${d.pageCount === 1 ? "" : "s"}` : ""}</span>
                      </div>
                      <PacketParts doc={d} parts={parts[d.id] ?? []} onChange={(ps) => setParts((x) => ({ ...x, [d.id]: ps }))} onView={(pg) => { setDocIdx(i); setFocus({ page: pg, box: null, label: `Page ${pg}`, n: Date.now() }); }} disabled={handled} />
                    </div>
                  );
                })}
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
