// Reports: pick one, set the dates, view it, download it. Every run is written to the audit log.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, Download, Clock, Users } from "lucide-react";
import { get } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Page } from "@/components/Shell";
import { DateInput, ErrorBox, Field, Segmented } from "@/components/inputs";
import { formatCents } from "@shared/money";
import { isoToDisplay, todayIso } from "@shared/dates";

type Report = { columns: { key: string; label: string; money?: boolean }[]; rows: Record<string, unknown>[]; totals: Record<string, unknown> | null };
const REPORTS = [
  { key: "daily-activity", title: "Daily activity", body: "What was posted each day: charges, payments, write-offs…", icon: <CalendarRange size={18} />, params: "range" },
  { key: "aging", title: "Aging (what's owed, by age)", body: "Open balances by patient or payer, in 30-day buckets.", icon: <Clock size={18} />, params: "asOf" },
  { key: "monthly-receivables", title: "Monthly receivables", body: "Charges, payments and ending balance for each month of a year.", icon: <BarChart3 size={18} />, params: "year" },
  { key: "productivity", title: "Team productivity", body: "Patients, charges, payments, notes and documents by team member.", icon: <Users size={18} />, params: "range" },
] as const;

export function Reports({ portal }: { portal?: boolean }) {
  const { activeClient } = useSession();
  const [which, setWhich] = useState<(typeof REPORTS)[number]["key"]>("daily-activity");
  const [from, setFrom] = useState<string | undefined>(todayIso().slice(0, 8) + "01");
  const [to, setTo] = useState<string | undefined>(todayIso());
  const [asOf, setAsOf] = useState<string | undefined>(todayIso());
  const [groupBy, setGroupBy] = useState<"patient" | "payer">("patient");
  const [year, setYear] = useState(Number(todayIso().slice(0, 4)));
  const def = REPORTS.find((r) => r.key === which)!;
  const params = new URLSearchParams();
  if (def.params === "range") { if (from) params.set("from", from); if (to) params.set("to", to); }
  if (def.params === "asOf") { if (asOf) params.set("asOf", asOf); if (groupBy === "payer") params.set("groupBy", "payer"); }
  if (def.params === "year") params.set("year", String(year));
  const url = `/api/reports/${which}?${params}`;
  const q = useQuery({ queryKey: ["report", url], queryFn: () => get<Report>(url) });
  const fmt = (c: Report["columns"][number], v: unknown) => (c.money && typeof v === "number" ? `$${formatCents(v)}` : /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? isoToDisplay(String(v)) : String(v ?? ""));
  const list = portal ? REPORTS.filter((r) => r.key !== "productivity") : REPORTS;

  return (
    <Page title="Reports" subtitle={`For ${activeClient?.name ?? "this client"} only. Downloads are logged.`} width="max-w-7xl">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((r) => (
          <button key={r.key} onClick={() => setWhich(r.key)} className={`card flex items-start gap-3 p-4 text-left transition ${which === r.key ? "ring-2 ring-navy-600" : "hover:shadow-lift"}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{r.icon}</span>
            <span><span className="block text-sm font-semibold text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{r.body}</span></span>
          </button>
        ))}
      </div>
      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        {def.params === "range" && (<><Field label="From"><DateInput value={from} onChange={setFrom} className="w-40" /></Field><Field label="To"><DateInput value={to} onChange={setTo} className="w-40" /></Field></>)}
        {def.params === "asOf" && (<><Field label="As of"><DateInput value={asOf} onChange={setAsOf} className="w-40" /></Field><Field label="Group by"><Segmented value={groupBy} onChange={setGroupBy} options={[{ code: "patient", label: "Patient" }, { code: "payer", label: "Payer" }]} /></Field></>)}
        {def.params === "year" && <Field label="Year"><input className="input w-28" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>}
        <a className="btn btn-primary ml-auto" href={`${url}&format=csv`}><Download size={15} /> Download CSV</a>
      </div>
      <ErrorBox error={q.error} />
      {q.isLoading && <div className="text-slate-500">Running…</div>}
      {q.data && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
              <tr>{q.data.columns.map((c) => <th key={c.key} className={`whitespace-nowrap px-4 py-3 font-medium ${c.money ? "text-right" : ""}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.rows.map((r, i) => <tr key={i}>{q.data!.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-2 ${c.money ? "money text-right" : "text-slate-700"}`}>{fmt(c, r[c.key])}</td>)}</tr>)}
              {q.data.rows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-400" colSpan={q.data.columns.length}>Nothing in this period.</td></tr>}
            </tbody>
            {q.data.totals && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>{q.data.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 ${c.money ? "money text-right" : ""}`}>{fmt(c, q.data!.totals![c.key])}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Page>
  );
}
