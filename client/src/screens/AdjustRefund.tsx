// Adjustments and refunds (old "Adjustments/Refunds" menu: Adjustment Posting, Ctrl+J, and Refunds Posting).
// ASSUMPTION Q-067: a refund puts money we sent back onto the balance; an adjustment raises or lowers a balance.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { post } from "@/lib/api";
import type { LedgerView } from "@/lib/types";
import { ErrorBox, Field, Money, MoneyInput, Segmented, TextInput } from "@/components/inputs";
import { useToast } from "@/components/ui";
import { isoToDisplay } from "@shared/dates";
import { formatCents, sumCents } from "@shared/money";

export function AdjustRefund({ L, encounterId: initial, onDone }: { L: LedgerView; encounterId?: number; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<"adjustment" | "refund">("adjustment");
  const [encounterId, setEncounterId] = useState<number | undefined>(initial);
  const [side, setSide] = useState<"insurance" | "patient">("insurance");
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [amountCents, setAmount] = useState<number | undefined>();
  const [reason, setReason] = useState("");
  const [paidTo, setPaidTo] = useState(L.insurances[0]?.payerName ?? "");
  const [checkNumber, setCheckNumber] = useState("");

  const scope = encounterId ? L.entries.filter((e) => e.encounterId === encounterId) : L.entries;
  const before = { ins: sumCents(scope.map((e) => e.insuranceDeltaCents)), pat: sumCents(scope.map((e) => e.patientDeltaCents)) };
  const dir = kind === "refund" ? "increase" : direction;
  const delta = (amountCents ?? 0) * (dir === "increase" ? 1 : -1);
  const after = { ins: before.ins + (side === "insurance" ? delta : 0), pat: before.pat + (side === "patient" ? delta : 0) };
  const missing = [!amountCents && "an amount", reason.trim().length < 3 && "a reason", kind === "refund" && !paidTo.trim() && "who the refund went to"].filter(Boolean) as string[];

  const m = useMutation({
    mutationFn: () =>
      post<{ warnings: string[] }>(`/api/patients/${L.patient.id}/adjustments`, {
        kind, encounterId, side, direction: dir, amountCents, reason: reason.trim(),
        paidTo: kind === "refund" ? paidTo.trim() : undefined, checkNumber: checkNumber || undefined, paymentType: kind === "refund" ? "CHECK" : undefined,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ledger", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["overview", L.patient.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(kind === "refund" ? "Refund posted." : "Adjustment posted.");
      r.warnings.forEach((w) => toast(w, "warning"));
      onDone();
    },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <section className="card space-y-5 p-6">
        <Segmented value={kind} onChange={(v) => setKind(v)} options={[{ code: "adjustment", label: "Adjustment" }, { code: "refund", label: "Refund" }]} />
        <p className="-mt-2 text-xs text-slate-500">
          {kind === "adjustment"
            ? "Raises or lowers what insurance or the patient owes, with a reason. To undo a posting made by mistake, reverse it on the ledger instead."
            : "Money we received and sent back (an overpayment, or a payment posted to the wrong account). It goes back onto the balance."}
        </p>
        <Field label="Claim">
          <select className="input" value={encounterId ?? ""} onChange={(e) => setEncounterId(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Whole account (not one claim)</option>
            {[...L.encounters].reverse().map((e) => <option key={e.id} value={e.id}>{isoToDisplay(e.serviceDateFrom)} · {e.lines.map((l) => l.hcpcsCode).join(", ")}</option>)}
          </select>
        </Field>
        <div className="flex flex-wrap gap-6">
          <Field label="Whose balance?"><Segmented value={side} onChange={setSide} options={[{ code: "insurance", label: "Insurance" }, { code: "patient", label: "Patient" }]} /></Field>
          {kind === "adjustment" && <Field label="Direction"><Segmented value={direction} onChange={setDirection} options={[{ code: "decrease", label: "Lower the balance" }, { code: "increase", label: "Raise the balance" }]} /></Field>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label="Amount" required><MoneyInput cents={amountCents} onChange={setAmount} autoFocus /></Field>
          <Field label="Reason" required><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={kind === "refund" ? "e.g. Duplicate payment returned" : "e.g. Contract rate correction"} /></Field>
        </div>
        {kind === "refund" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Refund paid to" required>
              <input className="input" list="refund-payees" value={paidTo} onChange={(e) => setPaidTo(e.target.value.toUpperCase())} maxLength={60} />
              <datalist id="refund-payees">
                {L.insurances.map((i) => <option key={i.rank} value={i.payerName} />)}
                <option value={`${L.patient.lastName}, ${L.patient.firstName}`} />
              </datalist>
            </Field>
            <Field label="Refund check #"><TextInput value={checkNumber} onChange={setCheckNumber} maxLength={30} upper /></Field>
          </div>
        )}
      </section>
      <aside className="card self-start p-5">
        <div className="card-title">What will happen</div>
        <div className="mt-1 text-xs text-slate-500">{encounterId ? "This claim" : "Whole account"}</div>
        <div className="mt-4 space-y-3 text-sm">
          {[{ label: "Insurance owes", b: before.ins, a: after.ins }, { label: "Patient owes", b: before.pat, a: after.pat }].map((r) => (
            <div key={r.label}>
              <div className="text-xs text-slate-500">{r.label}</div>
              <div className="mt-0.5 flex items-center gap-2"><Money cents={r.b} className="text-slate-400" /><ArrowRight size={14} className="text-slate-300" /><Money cents={r.a} className={`font-semibold ${r.a !== r.b ? "text-navy-800" : "text-slate-700"}`} /></div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-medium text-slate-600">New balance</span>
          <Money cents={after.ins + after.pat} className="text-xl font-semibold text-navy-800" />
        </div>
        <button className="btn btn-accent mt-5 h-11 w-full" disabled={missing.length > 0 || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "Posting…" : kind === "refund" ? `Post $${formatCents(amountCents ?? 0)} refund` : "Post adjustment"}
        </button>
        {missing.length > 0 && <div className="mt-2 text-center text-xs text-slate-400">Still needed: {missing.join(", ")}</div>}
        <div className="mt-3"><ErrorBox error={m.error} /></div>
      </aside>
    </div>
  );
}
