import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { PatientSummary } from "@/lib/types";
import { isoToDisplay } from "@shared/dates";

/** The magnifying-glass patient search: last name, "LAST, FIRST" or account number. */
export function PatientPicker({ onPick, title = "Find a patient" }: { onPick: (p: PatientSummary) => void; title?: string }) {
  const [q, setQ] = useState("");
  const { data, isFetching, error } = useQuery({
    queryKey: ["patients", q],
    queryFn: () => get<PatientSummary[]>(`/api/patients?q=${encodeURIComponent(q)}`),
  });
  return (
    <div className="panel mx-auto mt-6 max-w-2xl">
      <div className="panel-title">🔍 {title}</div>
      <div className="space-y-3 p-3">
        <input
          className="input w-full"
          autoFocus
          placeholder="Type a last name, LAST, FIRST, or account number"
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && data?.length === 1) onPick(data[0]);
          }}
        />
        {error && <div className="text-red-700">{(error as Error).message}</div>}
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase text-slate-500">
              <th className="py-1">Acct #</th>
              <th>Name</th>
              <th>DOB</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id} className="cursor-pointer border-t border-slate-100 hover:bg-navy-50" onClick={() => onPick(p)}>
                <td className="py-1 font-mono">{p.accountNumber}</td>
                <td>
                  {p.lastName}, {p.firstName}
                </td>
                <td>{isoToDisplay(p.dob)}</td>
                <td>{p.coverageType}</td>
              </tr>
            ))}
            {data && data.length === 0 && !isFetching && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-slate-500">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
