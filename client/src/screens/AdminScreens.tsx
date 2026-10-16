import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import { get, post } from "@/lib/api";
import { Page } from "@/components/Shell";
import { Badge, useToast } from "@/components/ui";
import { DateInput, ErrorBox, Field } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

type AuditRow = { id: number; at: string; userInitials: string; action: string; entityType: string; entityId: string | null; patientId: number | null; details: string | null };

const ACTION_TONE: Record<string, "slate" | "green" | "amber" | "red" | "navy"> = { view: "slate", search: "slate", create: "green", post: "green", update: "navy", reveal: "amber", reverse: "amber", remove: "red", close: "red" };

export function AuditLogScreen() {
  const { data, error, isLoading } = useQuery({ queryKey: ["audit"], queryFn: () => get<AuditRow[]>("/api/audit") });
  return (
    <Page title="Audit log" subtitle="Every view, change and posting of patient data in this client, newest first. These records can't be edited or deleted.">
      <ErrorBox error={error} />
      {isLoading && <div className="text-slate-500">Loading…</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
            <tr><th className="px-5 py-3 font-medium">When</th><th className="font-medium">Who</th><th className="font-medium">Action</th><th className="font-medium">What</th><th className="font-medium">Record</th><th className="font-medium">Patient #</th><th className="px-5 font-medium">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{new Date(r.at).toLocaleString()}</td>
                <td className="font-medium text-slate-800">{r.userInitials}</td>
                <td><Badge tone={ACTION_TONE[r.action] ?? "slate"}>{r.action}</Badge></td>
                <td className="text-slate-600">{r.entityType}</td>
                <td className="font-mono text-xs text-slate-500">{r.entityId}</td>
                <td className="font-mono text-xs text-slate-500">{r.patientId}</td>
                <td className="px-5 text-xs text-slate-400">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

export function CloseBooksScreen() {
  const qc = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState<string | undefined>();
  const periods = useQuery({ queryKey: ["periods"], queryFn: () => get<{ id: number; closedThrough: string; closedAt: string; closedBy: string }[]>("/api/periods") });
  const close = useMutation({
    mutationFn: () => post("/api/periods/close", { closedThrough: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`Books closed through ${isoToDisplay(date)}.`);
      setDate(undefined);
    },
  });
  return (
    <Page title="Close the books" subtitle="Lock a finished period so nothing dated in it can change." width="max-w-3xl">
      <div className="card p-6">
        <div className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Lock size={18} /></span>
          <div className="text-sm text-slate-600">
            Closing the books locks every date on or before the close date. Nothing can be posted in a closed period. Corrections go into the current open period instead. <b>This can't be undone.</b>
          </div>
        </div>
        <div className="mt-6 flex items-end gap-3">
          <Field label="Close the books through" className="w-56"><DateInput value={date} onChange={setDate} /></Field>
          <button className="btn btn-danger" disabled={!date || close.isPending} onClick={() => confirm(`Close the books through ${isoToDisplay(date)}? This can't be undone.`) && close.mutate()}>Close books</button>
        </div>
        <div className="mt-3"><ErrorBox error={close.error} /></div>
      </div>
      <div className="card mt-6">
        <div className="card-head"><div className="card-title">History</div></div>
        <ul className="divide-y divide-slate-100">
          {periods.data?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <ShieldCheck size={16} className="text-accent-600" />
              <span className="flex-1 font-medium text-slate-800">Closed through {isoToDisplay(p.closedThrough)}</span>
              <span className="text-slate-500">{new Date(p.closedAt).toLocaleString()} · {p.closedBy}</span>
            </li>
          ))}
          {periods.data?.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No periods closed yet.</li>}
        </ul>
      </div>
    </Page>
  );
}
