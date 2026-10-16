import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { DateInput, ErrorBox, Field } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

type AuditRow = { id: number; at: string; userInitials: string; action: string; entityType: string; entityId: string | null; patientId: number | null; details: string | null };

export function AuditLogScreen() {
  const { data, error, isLoading } = useQuery({ queryKey: ["audit"], queryFn: () => get<AuditRow[]>("/api/audit") });
  return (
    <div className="space-y-2 p-3">
      <p className="text-[12px] text-slate-600">Every view, change and posting of patient data in this client, newest first. These records can't be edited or deleted.</p>
      <ErrorBox error={error} />
      {isLoading && <div className="text-slate-500">Loading…</div>}
      <div className="panel overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr><th className="px-2 py-1">When</th><th>User</th><th>Action</th><th>What</th><th>Record</th><th>Patient #</th><th>Details</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2 py-0.5">{new Date(r.at).toLocaleString()}</td>
                <td>{r.userInitials}</td>
                <td>{r.action}</td>
                <td>{r.entityType}</td>
                <td className="font-mono">{r.entityId}</td>
                <td className="font-mono">{r.patientId}</td>
                <td className="text-slate-500">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CloseBooksScreen() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string | undefined>();
  const periods = useQuery({ queryKey: ["periods"], queryFn: () => get<{ id: number; closedThrough: string; closedAt: string; closedBy: string }[]>("/api/periods") });
  const close = useMutation({
    mutationFn: () => post("/api/periods/close", { closedThrough: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
  });
  return (
    <div className="max-w-xl space-y-3 p-3">
      <p className="text-[12px] text-slate-600">
        Closing the books locks every date on or before the close date. Nothing can be posted in a closed period. Corrections go in the current open period.
      </p>
      <div className="flex items-end gap-2">
        <Field label="Close books through"><DateInput value={date} onChange={setDate} /></Field>
        <button className="btn btn-danger" disabled={!date || close.isPending} onClick={() => confirm(`Close the books through ${isoToDisplay(date)}? This can't be undone.`) && close.mutate()}>
          Close books
        </button>
      </div>
      <ErrorBox error={close.error} />
      <div className="panel">
        <div className="panel-title">History</div>
        <table className="w-full text-[12px]">
          <tbody>
            {periods.data?.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-2 py-1">Closed through {isoToDisplay(p.closedThrough)}</td>
                <td>{new Date(p.closedAt).toLocaleString()}</td>
                <td>{p.closedBy}</td>
              </tr>
            ))}
            {periods.data?.length === 0 && <tr><td className="px-2 py-2 text-slate-500">No periods closed yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
