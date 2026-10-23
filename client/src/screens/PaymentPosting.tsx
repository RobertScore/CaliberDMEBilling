// Post a payment: pick the claim, say who paid and how, enter the amounts, and see the result before posting.
// Follows the PAYMENT POSTING tab / old "Payments & Writeoffs Posting" front screen.
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Receipt, Layers } from "lucide-react";
import { post } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { DateInput, ErrorBox, Field, Money, MoneyInput, Segmented, Select, TextInput } from "@/components/inputs";
import { StepHeader, useToast } from "@/components/ui";
import { PAT_SHARE_TYPES, PAYMENT_TYPES, WRITEOFF_TYPES } from "@shared/picklists";
import { isoToDisplay, todayIso } from "@shared/dates";
import { formatCents, sumCents } from "@shared/money";

export function PaymentPosting({ L, encounterId: initial, onDone }: { L: LedgerView; encounterId?: number; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [encounterId, setEncounterId] = useState<number | undefined>(initial ?? L.encounters.at(-1)?.id);
  const [depositDate, setDepositDate] = useState<string | undefined>(todayIso()); // spec: defaults to the login date
  const [payerChoice, setPayerChoice] = useState<string>(L.insurances[0] ? `ins${L.insurances[0].rank}` : "patient");
  const [paymentType, setPaymentType] = useState<string>("CHECK");
  const [checkNumber, setCheckNumber] = useState("");
  const [claimControlNumber, setClaimControlNumber] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [approved, setApproved] = useState<number | undefined>();
  const [payment, setPayment] = useState<number | undefined>();
  const [writeoff, setWriteoff] = useState<number | undefined>();
  const [writeoffType, setWriteoffType] = useState("");
  const [patShare, setPatShare] = useState<number | undefined>();
  const [patShareType, setPatShareType] = useState("");

  const enc = L.encounters.find((e) => e.id === encounterId);
  const scopeEntries = enc ? L.entries.filter((e) => e.encounterId === enc.id) : L.entries;
  const billed = enc ? sumCents(enc.lines.map((l) => l.chargeCents)) : undefined;
  const before = useMemo(
    () => ({
      ins: sumCents(scopeEntries.map((e) => e.insuranceDeltaCents)),
      pat: sumCents(scopeEntries.map((e) => e.patientDeltaCents)),
    }),
    [scopeEntries],
  );
  const payerIsPatient = payerChoice === "patient";
  const pay = payment ?? 0, wo = writeoff ?? 0, ps = patShare ?? 0;
  const after = {
    ins: before.ins - (payerIsPatient ? 0 : pay) - wo - ps,
    pat: before.pat - (payerIsPatient ? pay : 0) + ps,
  };
  const payerName = payerIsPatient ? `${L.patient.lastName}, ${L.patient.firstName}` : (L.insurances.find((i) => `ins${i.rank}` === payerChoice)?.payerName ?? "");
  const suggestWo = billed !== undefined && approved !== undefined ? Math.max(0, billed - approved) : undefined;
  const missing = [
    !depositDate && "deposit date",
    pay + wo + ps === 0 && "an amount",
    wo > 0 && !writeoffType && "a write-off reason",
    ps > 0 && !patShareType && "a patient share reason",
  ].filter(Boolean) as string[];

  const submit = useMutation({
    mutationFn: () =>
      post<{ entries: unknown[]; warnings: string[] }>(`/api/patients/${L.patient.id}/payments`, {
        encounterId,
        serviceDateFrom: enc?.serviceDateFrom,
        serviceDateTo: enc?.serviceDateTo,
        depositDate,
        payerName,
        payerIsPatient,
        paymentType,
        checkNumber: checkNumber || undefined,
        claimControlNumber: claimControlNumber || undefined,
        batchNumber: batchNumber || undefined,
        paymentCents: pay,
        writeoffCents: wo,
        writeoffType: wo ? writeoffType : undefined,
        patShareCents: ps,
        patShareType: ps ? patShareType : undefined,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`Posted. Balance is now $${formatCents(after.ins + after.pat)}${enc ? " on this claim" : ""}.`);
      r.warnings.forEach((w) => toast(w, "warning"));
      onDone();
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <section className="card p-6">
          <StepHeader n={1} title="Which claim is this for?" done />
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...L.encounters].reverse().map((e) => {
              const bal = sumCents(L.entries.filter((x) => x.encounterId === e.id).map((x) => x.insuranceDeltaCents + x.patientDeltaCents));
              const sel = encounterId === e.id;
              return (
                <button key={e.id} type="button" onClick={() => setEncounterId(e.id)} className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${sel ? "border-navy-600 bg-navy-50/60 ring-2 ring-navy-100" : "border-slate-200 hover:border-slate-300"}`}>
                  <Receipt size={18} className="mt-0.5 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {isoToDisplay(e.serviceDateFrom)}{e.serviceDateTo !== e.serviceDateFrom && ` – ${isoToDisplay(e.serviceDateTo)}`}
                    </div>
                    <div className="truncate font-mono text-xs text-slate-500">{e.lines.map((l) => l.hcpcsCode).join(", ")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xs text-slate-400">Balance</div>
                    <Money cents={bal} className="text-sm font-medium" />
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setEncounterId(undefined)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${encounterId === undefined ? "border-navy-600 bg-navy-50/60 ring-2 ring-navy-100" : "border-slate-200 hover:border-slate-300"}`}>
              <Layers size={18} className="text-slate-500" />
              <div className="text-sm font-medium text-slate-700">Whole account <span className="block text-xs font-normal text-slate-500">Not tied to one claim</span></div>
            </button>
          </div>
        </section>

        <section className="card p-6">
          <StepHeader n={2} title="Who paid, and how?" done={!!depositDate} />
          <div className="mt-5 space-y-4">
            <div>
              <div className="label mb-2">Paid by</div>
              <div className="flex flex-wrap gap-2">
                {L.insurances.map((i) => (
                  <button key={i.rank} type="button" onClick={() => setPayerChoice(`ins${i.rank}`)} className={`rounded-lg border px-3 py-2 text-sm transition ${payerChoice === `ins${i.rank}` ? "border-navy-600 bg-navy-50/60 font-medium text-navy-800 ring-2 ring-navy-100" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {i.payerName}
                  </button>
                ))}
                <button type="button" onClick={() => setPayerChoice("patient")} className={`rounded-lg border px-3 py-2 text-sm transition ${payerIsPatient ? "border-navy-600 bg-navy-50/60 font-medium text-navy-800 ring-2 ring-navy-100" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  The patient
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Payment type">
                <Segmented value={paymentType} onChange={setPaymentType} options={PAYMENT_TYPES.map((p) => ({ code: p, label: ({ CHECK: "Check", EFT: "EFT", "CREDIT CARD": "Card", CASH: "Cash", VCC: "VCC" } as Record<string, string>)[p] ?? p }))} />
              </Field>
              <Field label="Deposit date" required className="w-44"><DateInput value={depositDate} onChange={setDepositDate} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Check / reference #"><TextInput value={checkNumber} onChange={setCheckNumber} maxLength={30} upper /></Field>
              <Field label="Claim control #"><TextInput value={claimControlNumber} onChange={setClaimControlNumber} maxLength={40} upper /></Field>
              <Field label="Batch #"><TextInput value={batchNumber} onChange={setBatchNumber} maxLength={20} upper /></Field>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <StepHeader n={3} title="Amounts" subtitle="Fill in only what applies." done={pay + wo + ps > 0} />
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Billed">
              <div className="input money flex items-center justify-end bg-slate-50 text-slate-500">{billed !== undefined ? `$${formatCents(billed)}` : "–"}</div>
            </Field>
            <Field label="Approved / allowed"><MoneyInput cents={approved} onChange={setApproved} /></Field>
            <Field label="Payment received"><MoneyInput cents={payment} onChange={setPayment} autoFocus /></Field>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-slate-50/70 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Field label="Write-off" hint={suggestWo !== undefined && suggestWo !== wo ? undefined : ""}>
                <MoneyInput cents={writeoff} onChange={setWriteoff} />
              </Field>
              {suggestWo !== undefined && suggestWo > 0 && suggestWo !== wo && (
                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700" onClick={() => setWriteoff(suggestWo)}>
                  <Sparkles size={12} /> Use billed − approved: ${formatCents(suggestWo)}
                </button>
              )}
              <Select value={writeoffType} onChange={setWriteoffType} options={WRITEOFF_TYPES.map((w) => ({ code: w.code, label: w.label }))} blank="Reason for write-off…" disabled={!wo} />
            </div>
            <div className="space-y-2">
              <Field label="Patient share"><MoneyInput cents={patShare} onChange={setPatShare} /></Field>
              <Select value={patShareType} onChange={setPatShareType} options={PAT_SHARE_TYPES.map((w) => ({ code: w.code, label: w.label }))} blank="Reason for patient share…" disabled={!ps} />
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <div className="card-title">What will happen</div>
          <div className="mt-1 text-xs text-slate-500">{enc ? `Claim ${isoToDisplay(enc.serviceDateFrom)}` : "Whole account"}</div>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: "Insurance owes", b: before.ins, a: after.ins },
              { label: "Patient owes", b: before.pat, a: after.pat },
            ].map((r) => (
              <div key={r.label}>
                <div className="text-xs text-slate-500">{r.label}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <Money cents={r.b} className="text-slate-400" />
                  <ArrowRight size={14} className="text-slate-300" />
                  <Money cents={r.a} className={`font-semibold ${r.a !== r.b ? "text-navy-800" : "text-slate-700"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-600">New balance</span>
            <Money cents={after.ins + after.pat} className={`text-xl font-semibold ${after.ins + after.pat === 0 ? "text-accent-700" : "text-navy-800"}`} />
          </div>
          {after.ins + after.pat < 0 && <div className="mt-2 text-xs text-amber-700">This would leave a credit balance. Double-check the amounts.</div>}
          <button className="btn btn-accent mt-5 h-11 w-full" disabled={missing.length > 0 || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Posting…" : "Post payment"}
          </button>
          {missing.length > 0 && <div className="mt-2 text-center text-xs text-slate-400">Still needed: {missing.join(", ")}</div>}
          <div className="mt-3"><ErrorBox error={submit.error} /></div>
        </div>
      </aside>
    </div>
  );
}
