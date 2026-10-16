// Post charges: a guided, three-step flow (when & who → diagnoses → items) with a live summary.
// Fields follow the CHARGE ENTRY tab / old "Service Lines Posting" screen: A-L diagnoses, up to 20 lines,
// HCPCS, up to 4 modifiers, diagnosis pointers, quantity and price.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, ChevronDown, Check, Circle } from "lucide-react";
import { get, post } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { CodeLookup } from "@/components/CodeLookup";
import { DateInput, ErrorBox, Field, Money, MoneyInput, TextInput } from "@/components/inputs";
import { StepHeader, useToast } from "@/components/ui";
import { formatCents } from "@shared/money";

type Line = { key: number; hcpcsCode: string; modifiers: string[]; description: string; diagnosisPointers: string; quantity: number; unitPriceCents?: number };
type Dx = { code: string; description: string };
let lineKey = 0;
const blankLine = (): Line => ({ key: ++lineKey, hcpcsCode: "", modifiers: [], description: "", diagnosisPointers: "A", quantity: 1 });
const QUICK_MODS = ["NU", "RR", "UE", "RT", "LT", "KX"];
const letter = (i: number) => String.fromCharCode(65 + i);

export function ChargeEntry({ L, onDone }: { L: LedgerView; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const mods = useQuery({ queryKey: ["modifiers"], queryFn: () => get<{ code: string; description: string }[]>("/api/codes/modifiers") });
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [toTouched, setToTouched] = useState(false); // "to" follows "from" until someone changes it
  const [rank, setRank] = useState(L.insurances[0]?.rank ?? 1);
  const [more, setMore] = useState(false);
  const [rendering, setRendering] = useState("");
  const [billing, setBilling] = useState("");
  const [facility, setFacility] = useState("");
  const [ordering, setOrdering] = useState("");
  const [pan, setPan] = useState("");
  const [panExp, setPanExp] = useState<string | undefined>();
  const [dx, setDx] = useState<Dx[]>([]);
  const [dxKey, setDxKey] = useState(0);
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (l.unitPriceCents ?? 0) * (l.quantity || 0), 0);
  const linesReady = lines.every((l) => /^[A-Z]\d{4}$/.test(l.hcpcsCode) && l.description.trim() && l.unitPriceCents !== undefined && l.diagnosisPointers);
  const checks = [
    { ok: !!from, label: "Date of service" },
    { ok: dx.length > 0, label: "At least one diagnosis" },
    { ok: linesReady, label: "Every item has a code, description and price" },
    { ok: L.insurances.length > 0, label: "Insurance on file" },
  ];
  const ready = checks.every((c) => c.ok);

  const submit = useMutation({
    mutationFn: () =>
      post<{ lines: unknown[] }>(`/api/patients/${L.patient.id}/encounters`, {
        serviceDateFrom: from,
        serviceDateTo: to ?? from,
        renderingProvider: rendering || undefined,
        billingProvider: billing || undefined,
        facility: facility || undefined,
        orderingDoctor: ordering || undefined,
        priorAuthNumber: pan || undefined,
        priorAuthExpires: panExp,
        diagnosisCodes: dx.map((d) => d.code),
        insuranceRank: rank,
        lines: lines.map(({ key: _k, ...l }) => ({ ...l, unitPriceCents: l.unitPriceCents ?? 0, modifiers: l.modifiers })),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`Charges posted: ${r.lines.length} item${r.lines.length > 1 ? "s" : ""}, $${formatCents(total)}.`);
      onDone();
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {/* Step 1 */}
        <section className="card p-6">
          <StepHeader n={1} title="When and who" subtitle="Dates of service and which insurance to bill." done={!!from} />
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Service from" required><DateInput value={from} onChange={(v) => { setFrom(v); if (!toTouched) setTo(v); }} /></Field>
            <Field label="Service to"><DateInput value={to} onChange={(v) => { setTo(v); setToTouched(true); }} /></Field>
          </div>
          <div className="mt-5">
            <div className="label mb-2">Bill to</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {L.insurances.map((i) => (
                <button key={i.rank} type="button" onClick={() => setRank(i.rank)} className={`rounded-lg border p-3 text-left transition ${rank === i.rank ? "border-navy-600 bg-navy-50/60 ring-2 ring-navy-100" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className="text-2xs font-medium uppercase tracking-wider text-slate-400">{["Primary", "Secondary", "Tertiary"][i.rank - 1]}</div>
                  <div className="mt-0.5 text-sm font-medium text-slate-900">{i.payerName}</div>
                  {i.claimNumber && <div className="text-xs text-slate-500">Claim {i.claimNumber}</div>}
                </button>
              ))}
              {L.insurances.length === 0 && <div className="text-sm text-amber-700">No insurance on file. Add it under “Patient & insurance” first.</div>}
            </div>
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-700" onClick={() => setMore((m) => !m)}>
            <ChevronDown size={16} className={`transition ${more ? "rotate-180" : ""}`} /> Providers & prior authorization {more ? "" : "(optional)"}
          </button>
          {more && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Rendering provider"><TextInput value={rendering} onChange={setRendering} maxLength={60} upper /></Field>
              <Field label="Billing provider"><TextInput value={billing} onChange={setBilling} maxLength={60} upper /></Field>
              <Field label="Facility"><TextInput value={facility} onChange={setFacility} maxLength={60} upper /></Field>
              <Field label="Ordering doctor"><TextInput value={ordering} onChange={setOrdering} maxLength={60} upper /></Field>
              <Field label="Prior authorization #"><TextInput value={pan} onChange={setPan} maxLength={30} upper /></Field>
              <Field label="Authorization expires"><DateInput value={panExp} onChange={setPanExp} /></Field>
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className="card p-6">
          <StepHeader n={2} title="Diagnoses" subtitle="Type a code or words. Each diagnosis gets a letter (A–L) that items point to." done={dx.length > 0} />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {dx.map((d, i) => (
              <span key={d.code} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy-800 text-xs font-semibold text-white">{letter(i)}</span>
                <span className="font-mono font-medium text-slate-900">{d.code}</span>
                <span className="max-w-[220px] truncate text-slate-500">{d.description}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setDx((x) => x.filter((y) => y.code !== d.code))} aria-label={`Remove ${d.code}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {dx.length < 12 && (
              <CodeLookup
                key={dxKey}
                kind="icd10"
                value=""
                className="w-56"
                placeholder={dx.length ? "Add another…" : "e.g. M25.561 or knee pain"}
                onPick={(code, desc) => {
                  if (!desc) return; // still typing
                  if (!dx.some((d) => d.code === code)) setDx((x) => [...x, { code, description: desc }]);
                  setDxKey((k) => k + 1);
                }}
              />
            )}
          </div>
        </section>

        {/* Step 3 */}
        <section className="card p-6">
          <StepHeader n={3} title="Items delivered" subtitle="HCPCS code, modifiers, which diagnoses apply, quantity and price." done={linesReady} />
          <div className="mt-5 space-y-3">
            {lines.map((l, idx) => (
              <div key={l.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-2 w-5 text-xs font-semibold text-slate-400">{idx + 1}</span>
                  <div className="grid flex-1 grid-cols-12 gap-3">
                    <Field label="HCPCS" className="col-span-3">
                      <CodeLookup kind="hcpcs" value={l.hcpcsCode} placeholder="E0218" onPick={(code, desc) => setLine(l.key, { hcpcsCode: code, ...(desc ? { description: desc.toUpperCase() } : {}) })} />
                    </Field>
                    <Field label="Description" className="col-span-9">
                      <TextInput value={l.description} onChange={(v) => setLine(l.key, { description: v })} maxLength={120} upper />
                    </Field>
                    <div className="col-span-12">
                      <div className="label mb-1.5">Modifiers <span className="font-normal text-slate-400">(up to 4)</span></div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[...new Set([...QUICK_MODS, ...l.modifiers])].map((m) => {
                          const on = l.modifiers.includes(m);
                          const desc = mods.data?.find((x) => x.code === m)?.description;
                          return (
                            <button key={m} type="button" title={desc} disabled={!on && l.modifiers.length >= 4}
                              onClick={() => setLine(l.key, { modifiers: on ? l.modifiers.filter((x) => x !== m) : [...l.modifiers, m] })}
                              className={`h-8 rounded-md border px-2.5 font-mono text-xs font-medium transition disabled:opacity-30 ${on ? "border-navy-700 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                              {m}
                            </button>
                          );
                        })}
                        <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600" value="" disabled={l.modifiers.length >= 4}
                          onChange={(e) => e.target.value && setLine(l.key, { modifiers: [...l.modifiers, e.target.value] })}>
                          <option value="">More…</option>
                          {mods.data?.filter((m) => !QUICK_MODS.includes(m.code) && !l.modifiers.includes(m.code)).map((m) => <option key={m.code} value={m.code}>{m.code}: {m.description}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="col-span-5">
                      <div className="label mb-1.5">Diagnoses for this item</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dx.length === 0 && <span className="text-xs text-slate-400">Add diagnoses in step 2</span>}
                        {dx.map((d, i) => {
                          const on = l.diagnosisPointers.includes(letter(i));
                          return (
                            <button key={d.code} type="button" title={`${d.code} ${d.description}`}
                              disabled={!on && l.diagnosisPointers.length >= 4}
                              onClick={() => setLine(l.key, { diagnosisPointers: on ? l.diagnosisPointers.replace(letter(i), "") : [...l.diagnosisPointers + letter(i)].sort().join("") })}
                              className={`h-8 w-8 rounded-md border text-xs font-semibold transition disabled:opacity-30 ${on ? "border-navy-700 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                              {letter(i)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Field label="Qty" className="col-span-2">
                      <input className="input text-right" type="number" min={1} max={999} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} />
                    </Field>
                    <Field label="Price each" className="col-span-3">
                      <MoneyInput cents={l.unitPriceCents} onChange={(c) => setLine(l.key, { unitPriceCents: c })} />
                    </Field>
                    <div className="col-span-2 flex flex-col items-end justify-end pb-2">
                      <div className="text-2xs text-slate-400">Line total</div>
                      <Money cents={(l.unitPriceCents ?? 0) * (l.quantity || 0)} className="font-semibold text-slate-900" />
                    </div>
                  </div>
                  {lines.length > 1 && (
                    <button type="button" className="mt-6 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove item">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" className="btn w-full border-dashed" disabled={lines.length >= 20} onClick={() => setLines((ls) => [...ls, blankLine()])}>
              <Plus size={16} /> Add another item
            </button>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <div className="card-title">Summary</div>
          <div className="mt-4 space-y-2 text-sm">
            {lines.map((l, i) => (
              <div key={l.key} className="flex justify-between gap-2">
                <span className="truncate text-slate-600">
                  <span className="font-mono">{l.hcpcsCode || `Item ${i + 1}`}</span> {l.modifiers.length > 0 && <span className="text-slate-400">{l.modifiers.join(" ")}</span>}
                </span>
                <Money cents={(l.unitPriceCents ?? 0) * (l.quantity || 0)} className="text-slate-800" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-600">Total charges</span>
            <Money cents={total} className="text-xl font-semibold text-navy-800" />
          </div>
          <ul className="mt-5 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className={`flex items-center gap-2 text-xs ${c.ok ? "text-accent-700" : "text-slate-400"}`}>
                {c.ok ? <Check size={14} /> : <Circle size={14} />} {c.label}
              </li>
            ))}
          </ul>
          <button className="btn btn-primary mt-5 h-11 w-full" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Posting…" : `Post charges${total ? ` · $${formatCents(total)}` : ""}`}
          </button>
          <div className="mt-3"><ErrorBox error={submit.error} /></div>
          <p className="mt-3 text-2xs leading-relaxed text-slate-400">Codes tagged “starter list” are a small unverified sample. Load the official CMS files before real billing.</p>
        </div>
      </aside>
    </div>
  );
}
