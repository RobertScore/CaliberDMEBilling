// Charge Entry (Ctrl+K). Follows the CHARGE ENTRY tab / old "Service Lines Posting" front screen:
// service dates, providers, diagnosis codes A-L, and up to 20 lines with HCPCS, 4 modifiers, pointers, qty, price.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { CodeLookup } from "@/components/CodeLookup";
import { DateInput, ErrorBox, Field, Money, MoneyInput, TextInput } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

type Line = { hcpcsCode: string; modifiers: string[]; description: string; diagnosisPointers: string; quantity: number; unitPriceCents?: number };
const blankLine = (): Line => ({ hcpcsCode: "", modifiers: [], description: "", diagnosisPointers: "A", quantity: 1 });
const LETTERS = "ABCDEFGHIJKL".split("");

export function ChargeEntry({ patientId, openLedger }: { patientId: number; openLedger: (id: number) => void }) {
  const qc = useQueryClient();
  const ledger = useQuery({ queryKey: ["ledger", patientId], queryFn: () => get<LedgerView>(`/api/patients/${patientId}/ledger`) });
  const mods = useQuery({ queryKey: ["modifiers"], queryFn: () => get<{ code: string; description: string }[]>("/api/codes/modifiers") });
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [toTouched, setToTouched] = useState(false); // "to" follows "from" until someone changes it
  const [rendering, setRendering] = useState("");
  const [billing, setBilling] = useState("");
  const [facility, setFacility] = useState("");
  const [ordering, setOrdering] = useState("");
  const [pan, setPan] = useState("");
  const [panExp, setPanExp] = useState<string | undefined>();
  const [rank, setRank] = useState(1);
  const [dx, setDx] = useState<string[]>(Array(12).fill(""));
  const [dxDesc, setDxDesc] = useState<string[]>(Array(12).fill(""));
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [done, setDone] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const filledDx = dx.slice(0, dx.findLastIndex((d) => d.trim()) + 1);
  const total = lines.reduce((s, l) => s + (l.unitPriceCents ?? 0) * (l.quantity || 0), 0);

  const postCharges = useMutation({
    mutationFn: () =>
      post<{ encounter: { id: number }; lines: unknown[] }>(`/api/patients/${patientId}/encounters`, {
        serviceDateFrom: from,
        serviceDateTo: to ?? from,
        renderingProvider: rendering || undefined,
        billingProvider: billing || undefined,
        facility: facility || undefined,
        orderingDoctor: ordering || undefined,
        priorAuthNumber: pan || undefined,
        priorAuthExpires: panExp,
        diagnosisCodes: filledDx,
        insuranceRank: rank,
        lines: lines.map((l) => ({ ...l, unitPriceCents: l.unitPriceCents ?? 0, modifiers: l.modifiers.filter(Boolean) })),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", patientId] });
      setDone(`Posted ${r.lines.length} line(s).`);
      setLines([blankLine()]);
      setFormKey((k) => k + 1);
    },
  });

  if (ledger.isLoading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (!ledger.data) return <div className="p-6"><ErrorBox error={ledger.error} /></div>;
  const L = ledger.data;

  return (
    <div className="space-y-3 p-3" key={formKey}>
      <div className="panel grid grid-cols-6 gap-x-4 p-3 text-[12px]">
        <div><span className="label">Patient</span><div className="font-semibold">{L.patient.lastName}, {L.patient.firstName}</div></div>
        <div><span className="label">Acct #</span><div className="font-mono">{L.patient.accountNumber}</div></div>
        <div><span className="label">Coverage</span><div>{L.patient.coverageType}</div></div>
        <div><span className="label">PT-share balance</span><div><Money cents={L.balances.patientBalanceCents} /></div></div>
        <div><span className="label">Balance</span><div className="font-bold"><Money cents={L.balances.totalBalanceCents} /></div></div>
        <div className="flex items-end justify-end"><button className="btn" onClick={() => openLedger(patientId)}>Ledger</button></div>
      </div>

      <section className="panel">
        <div className="panel-title">Service</div>
        <div className="grid grid-cols-12 gap-2 p-3">
          <Field label="Service from" className="col-span-2"><DateInput value={from} onChange={(v) => { setFrom(v); if (!toTouched) setTo(v); }} /></Field>
          <Field label="Service to" className="col-span-2"><DateInput value={to} onChange={(v) => { setTo(v); setToTouched(true); }} /></Field>
          <Field label="Bill to" className="col-span-4">
            <select className="input" value={rank} onChange={(e) => setRank(Number(e.target.value))}>
              {L.insurances.map((i) => (
                <option key={i.rank} value={i.rank}>{["Primary", "Secondary", "Tertiary"][i.rank - 1]}: {i.payerName}</option>
              ))}
              {L.insurances.length === 0 && <option value={1}>No insurance on file: add it in Patient Entry</option>}
            </select>
          </Field>
          <Field label="Prior auth (PAN)" className="col-span-2"><TextInput value={pan} onChange={setPan} maxLength={30} upper /></Field>
          <Field label="PAN expires" className="col-span-2"><DateInput value={panExp} onChange={setPanExp} /></Field>
          <Field label="Rendering provider" className="col-span-3"><TextInput value={rendering} onChange={setRendering} maxLength={60} upper /></Field>
          <Field label="Billing provider" className="col-span-3"><TextInput value={billing} onChange={setBilling} maxLength={60} upper /></Field>
          <Field label="Facility" className="col-span-3"><TextInput value={facility} onChange={setFacility} maxLength={60} upper /></Field>
          <Field label="Ordering doctor" className="col-span-3"><TextInput value={ordering} onChange={setOrdering} maxLength={60} upper /></Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Diagnosis codes (A–L)</div>
        <div className="grid grid-cols-4 gap-2 p-3">
          {LETTERS.map((letter, i) => (
            <div key={letter} className="flex items-center gap-1">
              <span className="w-4 font-bold text-navy-700">{letter}</span>
              <CodeLookup
                kind="icd10"
                value={dx[i]}
                className="w-28"
                onPick={(code, desc) => {
                  setDx((d) => d.map((x, j) => (j === i ? code : x)));
                  setDxDesc((d) => d.map((x, j) => (j === i ? desc : x)));
                }}
              />
              <span className="truncate text-[11px] text-slate-500" title={dxDesc[i]}>{dxDesc[i]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Service lines</div>
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-2">#</th><th>HCPCS</th><th>Modifiers</th><th>Description</th><th>Dx ptr</th><th>Qty</th><th>Price</th><th className="text-right">Charge</th><th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                <td className="px-2 py-1 font-mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="py-1"><CodeLookup kind="hcpcs" value={l.hcpcsCode} className="w-24" onPick={(code, desc) => setLine(i, { hcpcsCode: code, ...(desc ? { description: desc } : {}) })} /></td>
                <td className="py-1">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map((m) => (
                      <select key={m} className="input w-14 px-1" value={l.modifiers[m] ?? ""} onChange={(e) => { const next = [...l.modifiers]; next[m] = e.target.value; setLine(i, { modifiers: next }); }}>
                        <option value="" />
                        {mods.data?.map((x) => <option key={x.code} value={x.code} title={x.description}>{x.code}</option>)}
                      </select>
                    ))}
                  </div>
                </td>
                <td className="py-1"><input className="input w-72" value={l.description} maxLength={120} onChange={(e) => setLine(i, { description: e.target.value.toUpperCase() })} /></td>
                <td className="py-1"><input className="input w-14 font-mono" value={l.diagnosisPointers} maxLength={4} onChange={(e) => setLine(i, { diagnosisPointers: e.target.value.toUpperCase().replace(/[^A-L]/g, "") })} /></td>
                <td className="py-1"><input className="input w-14 text-right" type="number" min={1} max={999} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></td>
                <td className="py-1"><MoneyInput className="w-24" cents={l.unitPriceCents} onChange={(c) => setLine(i, { unitPriceCents: c })} /></td>
                <td className="py-1 text-right"><Money cents={(l.unitPriceCents ?? 0) * (l.quantity || 0)} /></td>
                <td className="py-1 pl-2">{lines.length > 1 && <button className="text-red-700" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td colSpan={7} className="px-2 py-1">
                <button className="btn" disabled={lines.length >= 20} onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Line</button>
              </td>
              <td className="text-right"><Money cents={total} /></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={!from || filledDx.length === 0 || postCharges.isPending} onClick={() => { setDone(null); postCharges.mutate(); }}>
          {postCharges.isPending ? "Posting…" : "OK / Post charges"}
        </button>
        {done && <span className="text-green-700">{done} <button className="underline" onClick={() => openLedger(patientId)}>Open ledger</button></span>}
        {L.closedThrough && <span className="ml-auto text-[11px] text-slate-500">Books closed through {isoToDisplay(L.closedThrough)}</span>}
      </div>
      <ErrorBox error={postCharges.error} />
      <p className="text-[11px] text-slate-500">
        Codes marked “starter list” are a small unverified sample. Before real billing, load the official CMS HCPCS and ICD-10 files.
      </p>
    </div>
  );
}
