import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Users } from "lucide-react";
import { get } from "@/lib/api";
import type { PatientSummary } from "@/lib/types";
import { useNav } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { Page } from "@/components/Shell";
import { Avatar, CoverageBadge, EmptyState } from "@/components/ui";
import { ErrorBox, Money } from "@/components/inputs";
import { ageOn, isoToDisplay, todayIso } from "@shared/dates";

export function Patients() {
  const nav = useNav();
  const { can } = useSession();
  const [q, setQ] = useState("");
  const { data, error, isFetching } = useQuery({ queryKey: ["patients", q], queryFn: () => get<PatientSummary[]>(`/api/patients?q=${encodeURIComponent(q)}`) });

  return (
    <Page
      title="Patients"
      subtitle="Search by last name, LAST, FIRST, or account number."
      actions={
        can("patient.create") && (
          <button className="btn btn-primary" onClick={() => nav.go({ name: "new-patient" })}>
            <UserPlus size={16} /> Register patient
          </button>
        )
      }
    >
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input h-12 pl-11 text-base" autoFocus placeholder="Start typing a name…" value={q} onChange={(e) => setQ(e.target.value.toUpperCase())} />
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="font-medium">Account</th>
              <th className="font-medium">Date of birth</th>
              <th className="font-medium">Coverage</th>
              <th className="px-5 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav.openPatient(p.id, `${p.lastName}, ${p.firstName}`)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={`${p.lastName}, ${p.firstName}`} size={32} />
                    <span className="font-medium text-slate-900">{p.lastName}, {p.firstName}</span>
                  </div>
                </td>
                <td className="font-mono text-slate-600">#{p.accountNumber}</td>
                <td className="text-slate-600">
                  {isoToDisplay(p.dob)} <span className="text-slate-400">({ageOn(p.dob, todayIso())})</span>
                </td>
                <td><CoverageBadge type={p.coverageType} /></td>
                <td className="px-5 text-right"><Money cents={p.balanceCents ?? 0} className={(p.balanceCents ?? 0) === 0 ? "text-slate-400" : "font-medium"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.length === 0 && !isFetching && <EmptyState icon={<Users size={20} />} title="No patients found" body={q ? `Nothing matches “${q}”.` : "No patients registered yet."} />}
      </div>
    </Page>
  );
}
