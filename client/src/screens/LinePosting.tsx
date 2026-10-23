// Line item posting (PAYMENT POSTING tab, "BACK SCREEN (LINE ITEM POSTING, ALLOWS 20 LINES)"; old Ctrl+U):
// one check from one payer, with the approved amount, payment, write-off and patient share for each charge line.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { get, post } from "@/lib/api";
import type { LedgerView, ListItem } from "@/lib/types";
import { DateInput, ErrorBox, Field, Money, MoneyInput, TextInput } from "@/components/inputs";
import { useToast } from "@/components/ui";
import { isoToDisplay, todayIso } from "@shared/dates";
import { formatCents, sumCents } from "@shared/money";

type LineAmounts = { allowed?: number; payment?: number; writeoff?: number; writeoffType: string; patShare?: number; patShareType: string };
const blank = (): LineAmounts => ({ writeoffType: "", patShareType: "" });

export function LinePosting({ L, encounterId: initial, onDone }: { L: LedgerView; encounterId?: number; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const lists = (name: string) => ({ queryKey: ["lists", name], queryFn: () => get<ListItem[]>(`/api/lists/${name}`), staleTime: 60_000 });
  const payTypes = useQuery(lists("payment_type"));
  const woTypes = useQuery(lists("writeoff"));
  const psTypes = useQuery(lists("pat_share"));

  const [encounterId, setEncounterId] = useState<number | undefined>(initial ?? L.encounters.at(-1)?.id);
  const enc = L.encounters.find((e) => e.id === encounterId);
  const [payer, setPayer] = useState<string>(enc ? `ins${enc.insuranceRank}` : L.insurances[0] ? `ins${L.insurances[0].rank}` : "patient");
  const [paymentType, setPaymentType] = useState("CHECK");
  const [depositDate, setDepositDate] = useState<string | undefined>(todayIso());
  const [checkNumber, setCheckNumber] = useState("");
  const [claimControlNumber, setClaimControlNumber] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [amounts, setAmounts] = useState<Record<number, LineAmounts>>({});

  const payerIsPatient = payer === "patient";
  const payerName = payerIsPatient ? `${L.patient.lastName}, ${L.patient.firstName}` : L.insurances.find((i) => `ins${i.rank}` === payer)?.payerName ?? "";
  const set = (lineId: number, patch: Partial<LineAmounts>) => setAmounts((a) => ({ ...a, [lineId]: { ...(a[lineId] ?? blank()), ...patch } }));
  const balanceOf = (lineId: number) => sumCents(L.entries.filter((e) => e.serviceLineId === lineId).map((e) => e.insuranceDeltaCents + e.patientDeltaCents));
  const claimLevel = enc ? sumCents(L.entries.filter((e) => e.encounterId === enc.id && !e.serviceLineId).map((e) => e.insuranceDeltaCents + e.patientDeltaCents)) : 0;

  const rows = useMemo(() => (enc?.lines ?? []).map((l) => {
    const a = amounts[l.id] ?? blank();
    const before = balanceOf(l.id);
    const pay = a.payment ?? 0, wo = a.writeoff ?? 0, ps = a.patShare ?? 0;
    // Patient share moves money from insurance to the patient; the line's total only drops by payments and write-offs.
    return { l, a, before, after: before - pay - wo, insAfter: before - (payerIsPatient ? 0 : pay) - wo - ps, used: pay + wo + ps > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [enc, amounts, L.entries, payerIsPatient]);

  const totals = { pay: sumCents(rows.map((r) => r.a.payment ?? 0)), wo: sumCents(rows.map((r) => r.a.writeoff ?? 0)), ps: sumCents(rows.map((r) => r.a.patShare ?? 0)) };
  const missing = [
    !enc && "a claim",
    !depositDate && "deposit date",
    !rows.some((r) => r.used) && "an amount on at least one line",
    rows.some((r) => (r.a.writeoff ?? 0) > 0 && !r.a.writeoffType) && "a write-off reason for each line with a write-off",
    rows.some((r) => (r.a.patShare ?? 0) > 0 && !r.a.patShareType) && "a patient share reason for each line with one",
  ].filter(Boolean) as string[];

  const submit = useMutation({
    mutationFn: () =>
      post<{ entries: unknown[]; warnings: string[] }>(`/api/patients/${L.patient.id}/line-payments`, {
        encounterId, depositDate, payerName, payerIsPatient, paymentType,
        checkNumber: checkNumber || undefined, claimControlNumber: claimControlNumber || undefined, batchNumber: batchNumber || undefined,
        lines: rows.filter((r) => r.used || r.a.allowed !== undefined).map((r) => ({
          serviceLineId: r.l.id,
          allowedCents: r.a.allowed,
          paymentCents: r.a.payment ?? 0,
          writeoffCents: r.a.writeoff ?? 0,
          writeoffType: r.a.writeoff ? r.a.writeoffType : undefined,
          patShareCents: r.a.patShare ?? 0,
          patShareType: r.a.patShare ? r.a.patShareType : undefined,
        })),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["overview", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`Posted ${r.entries.length} line entr${r.entries.length === 1 ? "y" : "ies"}.`);
      r.warnings.forEach((w) => toast(w, "warning"));
      onDone();
    },
  });

  const sel = "input h-8 px-2 text-xs";
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Claim">
            <select className="input" value={encounterId ?? ""} onChange={(e) => { setEncounterId(Number(e.target.value)); setAmounts({}); }}>
              {[...L.encounters].reverse().map((e) => <option key={e.id} value={e.id}>{isoToDisplay(e.serviceDateFrom)} · {e.lines.map((l) => `${l.hcpcsCode}${l.modifiers.length ? ` ${l.modifiers.join(" ")}` : ""}`).join(", ")}</option>)}
            </select>
          </Field>
          <Field label="Paid by">
            <div className="flex flex-wrap gap-1.5">
              {L.insurances.map((i) => (
                <button key={i.rank} type="button" onClick={() => setPayer(`ins${i.rank}`)} className={`h-10 rounded-lg border px-3 text-sm ${payer === `ins${i.rank}` ? "border-navy-600 bg-navy-50 font-medium text-navy-800 ring-2 ring-navy-100" : "border-slate-200 text-slate-600"}`}>{i.payerName}</button>
              ))}
              <button type="button" onClick={() => setPayer("patient")} className={`h-10 rounded-lg border px-3 text-sm ${payerIsPatient ? "border-navy-600 bg-navy-50 font-medium text-navy-800 ring-2 ring-navy-100" : "border-slate-200 text-slate-600"}`}>The patient</button>
            </div>
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Field label="Payment type">
            <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              {(payTypes.data ?? [{ code: "CHECK", label: "CHECK" } as ListItem]).map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Deposit date" required><DateInput value={depositDate} onChange={setDepositDate} /></Field>
          <Field label="Check / ref #"><TextInput value={checkNumber} onChange={setCheckNumber} maxLength={30} upper /></Field>
          <Field label="Claim control #"><TextInput value={claimControlNumber} onChange={setClaimControlNumber} maxLength={40} upper /></Field>
          <Field label="Batch #"><TextInput value={batchNumber} onChange={setBatchNumber} maxLength={20} upper /></Field>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-left text-2xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">#</th><th className="font-medium">Procedure</th>
              <th className="px-2 text-right font-medium">Billed</th><th className="px-2 text-right font-medium">Line balance</th>
              <th className="px-2 font-medium">Approved</th><th className="px-2 font-medium">Payment</th><th className="px-2 font-medium">Write-off</th><th className="px-2 font-medium">Patient share</th>
              <th className="px-3 text-right font-medium">Residual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, a, before, after }) => {
              const suggestWo = a.allowed !== undefined ? Math.max(0, before - a.allowed - (a.patShare ?? 0)) : undefined;
              return (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-slate-400">{l.lineNumber}</td>
                  <td className="py-2"><div className="font-mono font-medium">{l.hcpcsCode} {l.modifiers.join(" ")}</div><div className="max-w-[180px] truncate text-slate-500">{l.description}</div></td>
                  <td className="money px-2 py-2 text-right">{formatCents(l.chargeCents)}</td>
                  <td className="money px-2 py-2 text-right font-medium">{formatCents(before)}</td>
                  <td className="w-28 px-2 py-1.5"><MoneyInput cents={a.allowed} onChange={(v) => set(l.id, { allowed: v })} className="h-8 text-xs" /></td>
                  <td className="w-28 px-2 py-1.5">
                    <MoneyInput cents={a.payment} onChange={(v) => set(l.id, { payment: v })} className="h-8 text-xs" />
                    {a.allowed !== undefined && a.payment === undefined && a.allowed > 0 && <button className="mt-1 text-2xs font-medium text-navy-700" onClick={() => set(l.id, { payment: a.allowed })}>= approved</button>}
                  </td>
                  <td className="w-40 px-2 py-1.5">
                    <MoneyInput cents={a.writeoff} onChange={(v) => set(l.id, { writeoff: v })} className="h-8 text-xs" />
                    {suggestWo !== undefined && suggestWo > 0 && suggestWo !== a.writeoff && <button className="mt-1 flex items-center gap-0.5 text-2xs font-medium text-navy-700" onClick={() => set(l.id, { writeoff: suggestWo })}><Sparkles size={10} /> {formatCents(suggestWo)} (balance − approved)</button>}
                    {(a.writeoff ?? 0) > 0 && (
                      <select className={`${sel} mt-1 w-full ${!a.writeoffType ? "border-red-300" : ""}`} value={a.writeoffType} onChange={(e) => set(l.id, { writeoffType: e.target.value })}>
                        <option value="">Reason…</option>
                        {woTypes.data?.map((w) => <option key={w.code} value={w.code}>{w.code}-{w.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="w-40 px-2 py-1.5">
                    <MoneyInput cents={a.patShare} onChange={(v) => set(l.id, { patShare: v })} className="h-8 text-xs" />
                    {(a.patShare ?? 0) > 0 && (
                      <select className={`${sel} mt-1 w-full ${!a.patShareType ? "border-red-300" : ""}`} value={a.patShareType} onChange={(e) => set(l.id, { patShareType: e.target.value })}>
                        <option value="">Reason…</option>
                        {psTypes.data?.map((w) => <option key={w.code} value={w.code}>{w.code}-{w.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className={`money px-3 py-2 text-right font-semibold ${after < 0 ? "text-amber-700" : after === 0 ? "text-accent-700" : "text-navy-800"}`}>{formatCents(after)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-slate-600">Totals</td>
              <td className="money px-2 text-right">{formatCents(totals.pay)}</td>
              <td className="money px-2 text-right">{formatCents(totals.wo)}</td>
              <td className="money px-2 text-right">{formatCents(totals.ps)}</td>
              <td className="money px-3 text-right">{formatCents(sumCents(rows.map((r) => r.after)))}</td>
            </tr>
          </tfoot>
        </table>
        {claimLevel !== 0 && <div className="border-t border-slate-100 px-3 py-2 text-2xs text-amber-700">This claim also has {claimLevel < 0 ? "-" : ""}${formatCents(Math.abs(claimLevel))} in whole-claim postings that aren't tied to a line. They're not in the line balances above.</div>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-600">Check total <Money cents={totals.pay} className="font-semibold text-slate-900" /></div>
        {rows.some((r) => r.after < 0) && <span className="text-xs text-amber-700">A line would go below zero (a credit). Double-check the amounts.</span>}
        <span className="ml-auto text-xs text-slate-400">{missing.length ? `Still needed: ${missing.join(", ")}` : `${rows.filter((r) => r.used).length} line(s) ready`}</span>
        <button className="btn btn-accent h-10 px-6" disabled={missing.length > 0 || submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? "Posting…" : "Post line items"}</button>
      </div>
      <ErrorBox error={submit.error} />
    </div>
  );
}
