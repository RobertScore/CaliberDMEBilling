// Settings: the company customizes the tool here. Templates, drop-down lists, codes, payers,
// document requirements, providers and facilities, company info and ledger colors, and API keys.
// Things that older records point at (list items, codes, payers) are turned off, not deleted.
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building, Copy, FileCheck2, KeyRound, ListChecks, MessageSquareText, Palette, Plus, Stethoscope, Tags, Trash2, Wallet } from "lucide-react";
import { api, del, get, post, put } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { ListItem, Template } from "@/lib/types";
import { Page } from "@/components/Shell";
import { Badge, useToast } from "@/components/ui";
import { ErrorBox, Field, Modal, Select } from "@/components/inputs";
import { DOC_TYPES } from "@shared/documents";
import { LEDGER_KINDS, PAYER_TYPES, US_STATES } from "@shared/picklists";

type Tab = "templates" | "lists" | "codes" | "payers" | "requirements" | "providers" | "company" | "api";
const TABS: { key: Tab; label: string; icon: ReactNode; scope: "all" | "client" }[] = [
  { key: "templates", label: "Note templates", icon: <MessageSquareText size={16} />, scope: "all" },
  { key: "lists", label: "Drop-down lists", icon: <ListChecks size={16} />, scope: "all" },
  { key: "codes", label: "Codes", icon: <Tags size={16} />, scope: "all" },
  { key: "payers", label: "Payers", icon: <Wallet size={16} />, scope: "all" },
  { key: "requirements", label: "Required documents", icon: <FileCheck2 size={16} />, scope: "all" },
  { key: "providers", label: "Providers & facilities", icon: <Stethoscope size={16} />, scope: "client" },
  { key: "company", label: "Company & ledger colors", icon: <Palette size={16} />, scope: "client" },
  { key: "api", label: "API keys", icon: <KeyRound size={16} />, scope: "client" },
];

function useSaved() {
  const qc = useQueryClient();
  const toast = useToast();
  return (keys: string[][], msg = "Saved.") => {
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    toast(msg);
  };
}

// ---- Templates ------------------------------------------------------------------------
function Templates() {
  const saved = useSaved();
  const q = useQuery({ queryKey: ["settings", "templates"], queryFn: () => get<Template[]>("/api/settings/templates") });
  const cats = useQuery({ queryKey: ["lists", "note_category"], queryFn: () => get<ListItem[]>("/api/lists/note_category") });
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const save = useMutation({
    mutationFn: (t: Partial<Template>) => {
      const body = { name: t.name, category: t.category, body: t.body, followUpDays: t.followUpDays ?? null, active: t.active ?? true };
      return t.id ? api("PATCH", `/api/settings/templates/${t.id}`, body) : post("/api/settings/templates", body);
    },
    onSuccess: () => { setEdit(null); saved([["settings", "templates"], ["note-templates"]]); },
  });
  const remove = useMutation({ mutationFn: (id: number) => del(`/api/settings/templates/${id}`), onSuccess: () => { setEdit(null); saved([["settings", "templates"], ["note-templates"]], "Template deleted."); } });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Fill-ins: <code className="text-xs">{"{{patient}} {{account}} {{payer}} {{claim}} {{adjuster}} {{today}}"}</code>. A follow-up puts the account on the Call List.</p>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ name: "", category: "general", body: "", followUpDays: null, active: true })}><Plus size={14} /> New template</button>
      </div>
      <div className="card divide-y divide-slate-100">
        {q.data?.map((t) => (
          <button key={t.id} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-slate-50" onClick={() => setEdit(t)}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium text-slate-900">{t.name} <Badge tone="slate">{cats.data?.find((c) => c.code === t.category)?.label ?? t.category}</Badge>{!t.active && <Badge tone="red">Off</Badge>}{t.followUpDays ? <Badge tone="navy">follow up in {t.followUpDays}d</Badge> : null}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.body}</div>
            </div>
          </button>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit template" : "New template"} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name" required className="col-span-2"><input className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Category"><Select value={edit.category ?? "general"} onChange={(v) => setEdit({ ...edit, category: v })} options={(cats.data ?? []).map((c) => ({ code: c.code, label: c.label }))} /></Field>
            <Field label="Text" required className="col-span-3"><textarea className="input h-32 resize-none py-2" value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <Field label="Follow up after (days)" hint="blank = none"><input className="input" type="number" min={0} max={365} value={edit.followUpDays ?? ""} onChange={(e) => setEdit({ ...edit, followUpDays: e.target.value ? Number(e.target.value) : null })} /></Field>
            <label className="col-span-2 mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> In use</label>
          </div>
          <div className="mt-3"><ErrorBox error={save.error ?? remove.error} /></div>
          <div className="mt-5 flex gap-2">
            {edit.id && <button className="btn btn-ghost text-red-600" onClick={() => confirm("Delete this template? Notes already written with it stay as they are.") && remove.mutate(edit.id!)}><Trash2 size={14} /> Delete</button>}
            <button className="btn ml-auto" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!edit.name || !edit.body} onClick={() => save.mutate(edit)}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Drop-down lists ------------------------------------------------------------------
function Lists() {
  const saved = useSaved();
  const q = useQuery({ queryKey: ["settings", "lists"], queryFn: () => get<Record<string, { label: string; items: ListItem[] }>>("/api/settings/lists") });
  const [which, setWhich] = useState("writeoff");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const keys = [["settings", "lists"], ["lists"]];
  const add = useMutation({ mutationFn: () => post(`/api/settings/lists/${which}`, { code, label }), onSuccess: () => { setCode(""); setLabel(""); saved(keys, "Added."); } });
  const patch = useMutation({ mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => api("PATCH", `/api/settings/lists/items/${id}`, body), onSuccess: () => saved(keys) });
  const list = q.data?.[which];
  return (
    <div className="grid grid-cols-[220px_1fr] gap-5">
      <div className="space-y-1">
        {Object.entries(q.data ?? {}).map(([k, v]) => (
          <button key={k} onClick={() => setWhich(k)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${which === k ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{v.label}</button>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">{list?.label}</div><span className="text-2xs text-slate-400">Items in use on old entries can be turned off, not deleted</span></div>
        <ul className="divide-y divide-slate-50">
          {list?.items.map((i) => (
            <li key={i.id} className={`flex items-center gap-3 px-5 py-2 ${i.active ? "" : "opacity-50"}`}>
              <span className="w-24 font-mono text-xs text-slate-500">{i.code}</span>
              <input className="input h-8 flex-1" defaultValue={i.label} onBlur={(e) => e.target.value.trim() && e.target.value !== i.label && patch.mutate({ id: i.id, body: { label: e.target.value.trim() } })} />
              <button className="btn btn-ghost btn-sm" onClick={() => patch.mutate({ id: i.id, body: { active: !i.active } })}>{i.active ? "Turn off" : "Turn on"}</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <input className="input w-32 uppercase" placeholder="Code" value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <input className="input flex-1" placeholder="Label shown in the drop-down" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn btn-primary" disabled={!code || !label} onClick={() => add.mutate()}><Plus size={14} /> Add</button>
        </div>
        <div className="px-4 pb-4"><ErrorBox error={add.error ?? patch.error} /></div>
      </div>
    </div>
  );
}

// ---- Codes ----------------------------------------------------------------------------
type CodeRow = { id: number; code: string; shortDescription?: string; description?: string; effectiveFrom?: string | null; effectiveTo?: string | null; source?: string };
function Codes() {
  const saved = useSaved();
  const [kind, setKind] = useState<"hcpcs" | "icd10" | "modifiers">("hcpcs");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const q = useQuery({ queryKey: ["settings", "codes", kind, search], queryFn: () => get<CodeRow[]>(`/api/settings/codes/${kind}?q=${encodeURIComponent(search)}`) });
  const add = useMutation({ mutationFn: () => post(`/api/settings/codes/${kind}`, { code, description: desc }), onSuccess: () => { setCode(""); setDesc(""); saved([["settings", "codes"]], "Code added."); } });
  const retire = useMutation({ mutationFn: (r: CodeRow) => api("PATCH", `/api/settings/codes/${kind}/${r.id}`, { effectiveTo: r.effectiveTo ? null : new Date().toISOString().slice(0, 10) }), onSuccess: () => saved([["settings", "codes"]]) });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["hcpcs", "icd10", "modifiers"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === k ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600"}`}>{k === "hcpcs" ? "HCPCS" : k === "icd10" ? "ICD-10" : "Modifiers"}</button>
        ))}
        <input className="input ml-auto h-8 w-64 text-xs" placeholder="Search code or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Official code sets are loaded from CMS files (see the code import script). Add a code here only if it's missing from the official file; it's marked “Added in Settings”. Codes are never deleted, because old claims need them. Retire one by ending it. CPT is not loaded (needs an AMA license).</div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500"><tr><th className="px-5 py-2.5 font-medium">Code</th><th className="font-medium">Description</th><th className="font-medium">Dates</th><th className="font-medium">Source</th><th className="px-5" /></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {q.data?.map((r) => (
              <tr key={r.id} className={r.effectiveTo ? "opacity-50" : ""}>
                <td className="px-5 py-2 font-mono text-xs">{r.code}</td>
                <td className="text-slate-700">{r.shortDescription ?? r.description}</td>
                <td className="whitespace-nowrap text-xs text-slate-500">{r.effectiveFrom ?? "—"} → {r.effectiveTo ?? "open"}</td>
                <td className="max-w-[200px] truncate text-xs text-slate-400">{r.source}</td>
                <td className="px-5 text-right">{kind !== "modifiers" && <button className="btn btn-ghost btn-sm" onClick={() => retire.mutate(r)}>{r.effectiveTo ? "Reopen" : "End today"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <input className="input w-36 uppercase" placeholder={kind === "hcpcs" ? "E0218" : kind === "icd10" ? "M25.561" : "RR"} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <input className="input flex-1" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn btn-primary" disabled={!code || !desc} onClick={() => add.mutate()}><Plus size={14} /> Add code</button>
        </div>
        <div className="px-4 pb-4"><ErrorBox error={add.error ?? retire.error} /></div>
      </div>
    </div>
  );
}

// ---- Payers ---------------------------------------------------------------------------
type PayerRow = { id: number; name: string; payerType: string; state: string | null; address1: string | null; city: string | null; zip: string | null; phone: string | null; electronicPayerId: string | null; notes: string | null; active: boolean };
function Payers() {
  const saved = useSaved();
  const q = useQuery({ queryKey: ["settings", "payers"], queryFn: () => get<PayerRow[]>("/api/settings/payers") });
  const [edit, setEdit] = useState<Partial<PayerRow> | null>(null);
  const [filter, setFilter] = useState("");
  const save = useMutation({
    mutationFn: (p: Partial<PayerRow>) => {
      const { id, ...rest } = p;
      const body = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]));
      return id ? api("PATCH", `/api/settings/payers/${id}`, body) : post("/api/settings/payers", body);
    },
    onSuccess: () => { setEdit(null); saved([["settings", "payers"], ["payers"]]); },
  });
  const rows = (q.data ?? []).filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));
  const set = (k: keyof PayerRow, v: unknown) => setEdit((e) => ({ ...e, [k]: v }));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input className="input h-9 w-72" placeholder="Search payers…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEdit({ name: "", payerType: "WC", active: true })}><Plus size={14} /> New payer</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500"><tr><th className="px-5 py-2.5 font-medium">Payer</th><th className="font-medium">Type</th><th className="font-medium">State</th><th className="font-medium">Electronic ID</th><th className="font-medium">Phone</th><th className="px-5" /></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((p) => (
              <tr key={p.id} className={`cursor-pointer hover:bg-slate-50 ${p.active ? "" : "opacity-50"}`} onClick={() => setEdit(p)}>
                <td className="px-5 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="text-slate-600">{PAYER_TYPES.find((t) => t.code === p.payerType)?.label ?? p.payerType}</td>
                <td className="text-slate-600">{p.state ?? "—"}</td>
                <td className="font-mono text-xs text-slate-500">{p.electronicPayerId ?? "—"}</td>
                <td className="text-slate-500">{p.phone ?? ""}</td>
                <td className="px-5 text-right">{!p.active && <Badge tone="red">Off</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit payer" : "New payer"} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-6 gap-3">
            <Field label="Name" required className="col-span-4"><input className="input" value={edit.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Type" required className="col-span-2"><Select value={edit.payerType ?? "WC"} onChange={(v) => set("payerType", v)} options={PAYER_TYPES} /></Field>
            <Field label="Address" className="col-span-3"><input className="input" value={edit.address1 ?? ""} onChange={(e) => set("address1", e.target.value)} /></Field>
            <Field label="City" className="col-span-1"><input className="input" value={edit.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="State"><Select value={edit.state ?? ""} onChange={(v) => set("state", v)} options={US_STATES.map((s) => ({ code: s, label: s }))} blank="—" /></Field>
            <Field label="ZIP"><input className="input" value={edit.zip ?? ""} onChange={(e) => set("zip", e.target.value)} /></Field>
            <Field label="Phone" className="col-span-2"><input className="input" value={edit.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Electronic payer ID" className="col-span-2" hint="from the clearinghouse"><input className="input" value={edit.electronicPayerId ?? ""} onChange={(e) => set("electronicPayerId", e.target.value)} /></Field>
            <label className="col-span-2 mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => set("active", e.target.checked)} /> In use</label>
            <Field label="Notes" className="col-span-6"><input className="input" value={edit.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          </div>
          <div className="mt-3"><ErrorBox error={save.error} /></div>
          <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" disabled={!edit.name} onClick={() => save.mutate(edit)}>Save</button></div>
        </Modal>
      )}
    </div>
  );
}

// ---- Required documents ---------------------------------------------------------------
function Requirements() {
  const saved = useSaved();
  const q = useQuery({ queryKey: ["settings", "requirements"], queryFn: () => get<{ id: number; payerType: string; docType: string; required: boolean; source: string | null }[]>("/api/settings/requirements") });
  const set = useMutation({ mutationFn: (b: { payerType: string; docType: string; required: boolean }) => post("/api/settings/requirements", b), onSuccess: () => saved([["settings", "requirements"], ["documents"], ["overview"]]) });
  const isReq = (pt: string, dt: string) => !!q.data?.find((r) => r.payerType === pt && r.docType === dt)?.required;
  return (
    <div>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">These drive each patient's “ready to bill” checklist. The starting set is Claude's best guess (open question Q-017) and needs Caliber to confirm. Later these will also come from the rules library per state and HCPCS code.</div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr><th className="px-4 py-2.5 text-left font-medium">Document</th>{PAYER_TYPES.map((p) => <th key={p.code} className="px-2 font-medium">{p.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {DOC_TYPES.filter((d) => !["other", "eob", "packet"].includes(d.code)).map((d) => (
              <tr key={d.code}>
                <td className="px-4 py-2 text-slate-700">{d.label}</td>
                {PAYER_TYPES.map((p) => (
                  <td key={p.code} className="text-center">
                    <input type="checkbox" checked={isReq(p.code, d.code)} onChange={(e) => set.mutate({ payerType: p.code, docType: d.code, required: e.target.checked })} aria-label={`${d.label} required for ${p.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2"><ErrorBox error={set.error} /></div>
    </div>
  );
}

// ---- Providers & facilities (this client) ---------------------------------------------
type Provider = { id: number; kind: string; name: string; npi: string | null; taxonomy: string | null; phone: string | null; active: boolean };
type Facility = { id: number; name: string; address1: string | null; city: string | null; state: string | null; zip: string | null; npi: string | null; active: boolean };
function Providers() {
  const saved = useSaved();
  const pq = useQuery({ queryKey: ["client-settings", "providers"], queryFn: () => get<Provider[]>("/api/client-settings/providers") });
  const fq = useQuery({ queryKey: ["client-settings", "facilities"], queryFn: () => get<Facility[]>("/api/client-settings/facilities") });
  const [p, setP] = useState({ kind: "referring", name: "", npi: "" });
  const [f, setF] = useState({ name: "", city: "", state: "", npi: "" });
  const nul = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
  const addP = useMutation({ mutationFn: () => post("/api/client-settings/providers", nul(p)), onSuccess: () => { setP({ kind: "referring", name: "", npi: "" }); saved([["client-settings", "providers"]], "Provider added."); } });
  const addF = useMutation({ mutationFn: () => post("/api/client-settings/facilities", nul(f)), onSuccess: () => { setF({ name: "", city: "", state: "", npi: "" }); saved([["client-settings", "facilities"]], "Facility added."); } });
  const togP = useMutation({ mutationFn: (x: Provider) => api("PATCH", `/api/client-settings/providers/${x.id}`, { active: !x.active }), onSuccess: () => saved([["client-settings", "providers"]]) });
  const togF = useMutation({ mutationFn: (x: Facility) => api("PATCH", `/api/client-settings/facilities/${x.id}`, { active: !x.active }), onSuccess: () => saved([["client-settings", "facilities"]]) });
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="card">
        <div className="card-head"><div className="card-title">Providers</div></div>
        <ul className="divide-y divide-slate-50">
          {pq.data?.map((x) => (
            <li key={x.id} className={`flex items-center gap-3 px-5 py-2 text-sm ${x.active ? "" : "opacity-50"}`}>
              <Badge tone="slate">{x.kind}</Badge><span className="flex-1 text-slate-800">{x.name}</span><span className="font-mono text-xs text-slate-400">{x.npi ?? "no NPI"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => togP.mutate(x)}>{x.active ? "Turn off" : "Turn on"}</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <select className="input w-32" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value })}>{["rendering", "billing", "ordering", "referring"].map((k) => <option key={k}>{k}</option>)}</select>
          <input className="input flex-1" placeholder="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <input className="input w-32" placeholder="NPI (10)" value={p.npi} maxLength={10} onChange={(e) => setP({ ...p, npi: e.target.value.replace(/\D/g, "") })} />
          <button className="btn btn-primary" disabled={p.name.length < 2} onClick={() => addP.mutate()}><Plus size={14} /></button>
        </div>
        <div className="px-4 pb-3"><ErrorBox error={addP.error} /></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Facilities</div></div>
        <ul className="divide-y divide-slate-50">
          {fq.data?.map((x) => (
            <li key={x.id} className={`flex items-center gap-3 px-5 py-2 text-sm ${x.active ? "" : "opacity-50"}`}>
              <Building size={14} className="text-slate-400" /><span className="flex-1 text-slate-800">{x.name}<span className="ml-2 text-xs text-slate-400">{[x.city, x.state].filter(Boolean).join(", ")}</span></span><span className="font-mono text-xs text-slate-400">{x.npi ?? ""}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => togF.mutate(x)}>{x.active ? "Turn off" : "Turn on"}</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <input className="input flex-1" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input w-28" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input className="input w-16 uppercase" placeholder="ST" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} />
          <button className="btn btn-primary" disabled={f.name.length < 2} onClick={() => addF.mutate()}><Plus size={14} /></button>
        </div>
        <div className="px-4 pb-3"><ErrorBox error={addF.error ?? togF.error ?? togP.error} /></div>
      </div>
    </div>
  );
}

// ---- Company & ledger colors (this client) --------------------------------------------
type Company = { legalName?: string; billingNpi?: string; taxId?: string; phone?: string; address?: string; ledgerColors?: Record<string, string> };
function CompanySettings() {
  const saved = useSaved();
  const q = useQuery({ queryKey: ["company"], queryFn: () => get<Company>("/api/client-settings/company") });
  const [c, setC] = useState<Company>({});
  useEffect(() => { if (q.data) setC(q.data); }, [q.data]);
  const save = useMutation({ mutationFn: () => put("/api/client-settings/company", { legalName: c.legalName ?? "", billingNpi: c.billingNpi ?? "", taxId: c.taxId ?? "", phone: c.phone ?? "", address: c.address ?? "", ledgerColors: c.ledgerColors ?? {} }), onSuccess: () => saved([["company"]]) });
  const colors = { ...Object.fromEntries(Object.entries(LEDGER_KINDS).map(([k, v]) => [k, v.color])), ...(c.ledgerColors ?? {}) };
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="card p-5">
        <div className="card-title mb-3">Company (for claims and statements)</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Legal name" className="col-span-2"><input className="input" value={c.legalName ?? ""} onChange={(e) => setC({ ...c, legalName: e.target.value })} /></Field>
          <Field label="Billing NPI"><input className="input" maxLength={10} value={c.billingNpi ?? ""} onChange={(e) => setC({ ...c, billingNpi: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Tax ID"><input className="input" value={c.taxId ?? ""} onChange={(e) => setC({ ...c, taxId: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={c.phone ?? ""} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <Field label="Address" className="col-span-2"><input className="input" value={c.address ?? ""} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        </div>
      </div>
      <div className="card p-5">
        <div className="card-title mb-3">Ledger colors</div>
        <div className="space-y-2">
          {Object.entries(LEDGER_KINDS).map(([k, v]) => (
            <label key={k} className="flex items-center gap-3 text-sm">
              <input type="color" className="h-8 w-12 cursor-pointer rounded border border-slate-200" value={colors[k]} onChange={(e) => setC({ ...c, ledgerColors: { ...(c.ledgerColors ?? {}), [k]: e.target.value } })} />
              <span className="flex-1 rounded px-3 py-1.5" style={{ background: colors[k] }}>{v.label}</span>
            </label>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm mt-3" onClick={() => setC({ ...c, ledgerColors: {} })}>Back to the standard colors</button>
      </div>
      <div className="xl:col-span-2">
        <ErrorBox error={save.error} />
        <button className="btn btn-primary" onClick={() => save.mutate()}>Save company settings</button>
      </div>
    </div>
  );
}

// ---- API keys (this client) -----------------------------------------------------------
function ApiKeys() {
  const saved = useSaved();
  const { activeClient } = useSession();
  const q = useQuery({ queryKey: ["client-settings", "api-keys"], queryFn: () => get<{ id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }[]>("/api/client-settings/api-keys") });
  const [name, setName] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const add = useMutation({ mutationFn: () => post<{ key: string }>("/api/client-settings/api-keys", { name }), onSuccess: (r) => { setName(""); setShown(r.key); saved([["client-settings", "api-keys"]], "Key created."); } });
  const revoke = useMutation({ mutationFn: (id: number) => del(`/api/client-settings/api-keys/${id}`), onSuccess: () => saved([["client-settings", "api-keys"]], "Key turned off.") });
  return (
    <div>
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">A key lets another system (like CENCOM or a fax/email gateway) send paperwork into <b>{activeClient?.name}</b>'s Inbox. The key alone decides which client the data goes to. The full key is shown once; only a scrambled copy is stored.</div>
      <div className="card">
        <ul className="divide-y divide-slate-50">
          {q.data?.map((k) => (
            <li key={k.id} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${k.revokedAt ? "opacity-50" : ""}`}>
              <KeyRound size={14} className="text-slate-400" /><span className="flex-1 font-medium text-slate-800">{k.name}</span>
              <span className="font-mono text-xs text-slate-400">{k.prefix}…</span>
              <span className="text-xs text-slate-400">{k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}</span>
              {k.revokedAt ? <Badge tone="red">Off</Badge> : <button className="btn btn-ghost btn-sm text-red-600" onClick={() => confirm("Turn this key off? Anything using it will stop working.") && revoke.mutate(k.id)}>Turn off</button>}
            </li>
          ))}
          {q.data?.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No keys yet.</li>}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <input className="input flex-1" placeholder="What is it for? (e.g. CENCOM orders)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" disabled={name.trim().length < 2} onClick={() => add.mutate()}><Plus size={14} /> Create key</button>
        </div>
        <div className="px-4 pb-3"><ErrorBox error={add.error ?? revoke.error} /></div>
      </div>
      {shown && (
        <Modal title="Your new API key" subtitle="Copy it now. It won't be shown again." onClose={() => setShown(null)}>
          <div className="select-all break-all rounded-lg bg-slate-50 p-3 font-mono text-sm">{shown}</div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn" onClick={() => navigator.clipboard?.writeText(shown)}><Copy size={14} /> Copy</button>
            <button className="btn btn-primary" onClick={() => setShown(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SettingsScreen() {
  const { activeClient } = useSession();
  const [tab, setTab] = useState<Tab>("templates");
  const t = TABS.find((x) => x.key === tab)!;
  return (
    <Page title="Settings" subtitle="Customize how the team uses the tool. Changes take effect right away." width="max-w-7xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="space-y-4">
          {(["all", "client"] as const).map((scope) => (
            <div key={scope}>
              <div className="mb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400">{scope === "all" ? "All clients" : `Only ${activeClient?.name ?? "this client"}`}</div>
              {TABS.filter((x) => x.scope === scope).map((x) => (
                <button key={x.key} onClick={() => setTab(x.key)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${tab === x.key ? "bg-white font-medium text-navy-800 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60"}`}>
                  <span className={tab === x.key ? "text-navy-600" : "text-slate-400"}>{x.icon}</span>{x.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{t.label}</h2>
          {tab === "templates" && <Templates />}
          {tab === "lists" && <Lists />}
          {tab === "codes" && <Codes />}
          {tab === "payers" && <Payers />}
          {tab === "requirements" && <Requirements />}
          {tab === "providers" && <Providers />}
          {tab === "company" && <CompanySettings />}
          {tab === "api" && <ApiKeys />}
        </div>
      </div>
    </Page>
  );
}
