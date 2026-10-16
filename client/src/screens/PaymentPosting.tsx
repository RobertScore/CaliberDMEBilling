// Payment Posting (Ctrl+P). Follows the PAYMENT POSTING tab / old "Payments & Writeoffs Posting" front screen.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { DateInput, ErrorBox, Field, Money, MoneyInput, Select, TextInput } from "@/components/inputs";
import { PAT_SHARE_TYPES, PAYMENT_TYPES, WRITEOFF_TYPES } from "@shared/picklists";
import { isoToDisplay, todayIso } from "@shared/dates";
import { sumCents } from "@shared/money";

export function PaymentPosting({ patientId, openLedger }: { patientId: number; openLedger: (id: number) => void }) {
  const qc = useQueryClient();
  const ledger = useQuery({ queryKey: ["ledger", patientId], queryFn: () => get<LedgerView>(`/api/patients/${patientId}/ledger`) });
  const [encounterId, setEncounterId] = useState<number | undefined>();
  const [depositDate, setDepositDate] = useState<string | undefined>(todayIso()); // spec: defaults to login date
  const [payerChoice, setPayerChoice] = useState<string>("ins1");
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
  const [result, setResult] = useState<{ count: number; warnings: string[] } | null>(null);

  const L = ledger.data;
  const enc = L?.encounters.find((e) => e.id === encounterId);
  const billed = enc ? sumCents(enc.lines.map((l) => l.chargeCents)) : undefined;
  const payerIsPatient = payerChoice === "patient";
  const payerName = !L
    ? ""
    : payerIsPatient
      ? `${L.patient.lastName}, ${L.patient.firstName}`
      : (L.insurances.find((i) => `ins${i.rank}` === payerChoice)?.payerName ?? "");

  const submit = useMutation({
    mutationFn: () =>
      post<{ entries: unknown[]; warnings: string[] }>(`/api/patients/${patientId}/payments`, {
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
        paymentCents: payment ?? 0,
        writeoffCents: writeoff ?? 0,
        writeoffType: writeoff ? writeoffType : undefined,
        patShareCents: patShare ?? 0,
        patShareType: patShare ? patShareType : undefined,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", patientId] });
      setResult({ count: r.entries.length, warnings: r.warnings });
      setPayment(undefined);
      setWriteoff(undefined);
      setPatShare(undefined);
      setApproved(undefined);
    },
  });

  if (ledger.isLoading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (!L) return <div className="p-6"><ErrorBox error={ledger.error} /></div>;

  // Suggest the write-off as billed minus approved (the usual contractual adjustment). Staff can change it.
  const suggestWriteoff = billed !== undefined && approved !== undefined ? Math.max(0, billed - approved) : undefined;

  return (
    <div className="space-y-3 p-3">
      <div className="panel grid grid-cols-6 gap-x-4 p-3 text-[12px]">
        <div><span className="label">Patient</span><div className="font-semibold">{L.patient.lastName}, {L.patient.firstName}</div></div>
        <div><span className="label">Acct #</span><div className="font-mono">{L.patient.accountNumber}</div></div>
        <div><span className="label">Coverage</span><div>{L.patient.coverageType}</div></div>
        <div><span className="label">PT-share balance</span><div><Money cents={L.balances.patientBalanceCents} /></div></div>
        <div><span className="label">Balance</span><div className="font-bold"><Money cents={L.balances.totalBalanceCents} /></div></div>
        <div className="flex items-end justify-end"><button className="btn" onClick={() => openLedger(patientId)}>Ledger</button></div>
      </div>

      <section className="panel">
        <div className="panel-title">Payment</div>
        <div className="grid grid-cols-12 gap-2 p-3">
          <Field label="Claim / service dates" className="col-span-4">
            <select className="input" value={encounterId ?? ""} onChange={(e) => setEncounterId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Whole account (no specific claim)</option>
              {L.encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {isoToDisplay(e.serviceDateFrom)}–{isoToDisplay(e.serviceDateTo)} · {e.lines.map((l) => l.hcpcsCode).join(", ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deposit date" className="col-span-2"><DateInput value={depositDate} onChange={setDepositDate} /></Field>
          <Field label="Payer" className="col-span-3">
            <select className="input" value={payerChoice} onChange={(e) => setPayerChoice(e.target.value)}>
              {L.insurances.map((i) => <option key={i.rank} value={`ins${i.rank}`}>{i.payerName}</option>)}
              <option value="patient">Patient</option>
            </select>
          </Field>
          <Field label="Payment type" className="col-span-1">
            <Select value={paymentType} onChange={setPaymentType} options={PAYMENT_TYPES.map((p) => ({ code: p, label: p }))} />
          </Field>
          <Field label="Check #" className="col-span-2"><TextInput value={checkNumber} onChange={setCheckNumber} maxLength={30} upper /></Field>
          <Field label="Claim ctrl #" className="col-span-3"><TextInput value={claimControlNumber} onChange={setClaimControlNumber} maxLength={40} upper /></Field>
          <Field label="Batch #" className="col-span-2"><TextInput value={batchNumber} onChange={setBatchNumber} maxLength={20} upper /></Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Amounts</div>
        <div className="grid grid-cols-6 gap-2 p-3">
          <Field label="Billed"><input className="input text-right font-mono" disabled value={billed !== undefined ? (billed / 100).toFixed(2) : ""} /></Field>
          <Field label="Approved"><MoneyInput cents={approved} onChange={setApproved} /></Field>
          <Field label="Payment"><MoneyInput cents={payment} onChange={setPayment} /></Field>
          <Field label="Write-off" hint={suggestWriteoff !== undefined ? `suggest ${(suggestWriteoff / 100).toFixed(2)}` : undefined}>
            <MoneyInput cents={writeoff} onChange={setWriteoff} />
          </Field>
          <Field label="Write-off type" className="col-span-2">
            <Select value={writeoffType} onChange={setWriteoffType} options={WRITEOFF_TYPES.map((w) => ({ code: w.code, label: `${w.code}-${w.label}` }))} blank="" />
          </Field>
          <Field label="Pat share"><MoneyInput cents={patShare} onChange={setPatShare} /></Field>
          <Field label="Pat share type" className="col-span-2">
            <Select value={patShareType} onChange={setPatShareType} options={PAT_SHARE_TYPES.map((w) => ({ code: w.code, label: `${w.code}-${w.label}` }))} blank="" />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={!depositDate || submit.isPending} onClick={() => { setResult(null); submit.mutate(); }}>
          {submit.isPending ? "Posting…" : "OK / Post"}
        </button>
        <button className="btn" disabled title="Phase 2: line-item posting (20 lines)">Line item posting</button>
        {result && <span className="text-green-700">Posted {result.count} entr{result.count === 1 ? "y" : "ies"}. <button className="underline" onClick={() => openLedger(patientId)}>Open ledger</button></span>}
      </div>
      {result?.warnings.map((w) => <div key={w} className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">{w}</div>)}
      <ErrorBox error={submit.error} />
    </div>
  );
}
