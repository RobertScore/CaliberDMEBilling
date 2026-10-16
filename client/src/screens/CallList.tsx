// The Call List: every follow-up that's due, oldest first. Comes from notes with a follow-up date.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PhoneCall } from "lucide-react";
import { get, post } from "@/lib/api";
import { useNav } from "@/lib/nav";
import type { Task } from "@/lib/types";
import { Page } from "@/components/Shell";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Money, Segmented } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

export function CallList() {
  const nav = useNav();
  const qc = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<"open" | "done">("open");
  const q = useQuery({ queryKey: ["tasks", scope, status], queryFn: () => get<(Task & { doneAt: string | null; doneBy: string | null })[]>(`/api/tasks?scope=${scope}${status === "done" ? "&status=done" : ""}`) });
  const done = useMutation({
    mutationFn: (id: number) => post(`/api/tasks/${id}/done`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast("Marked done. Add a note on the account about what happened."); },
  });
  const rows = q.data ?? [];
  const overdue = rows.filter((r) => r.overdue).length;
  const today = rows.filter((r) => r.dueToday).length;

  return (
    <Page
      title="Call list"
      subtitle="Follow-ups from account notes. Open the account, make the call, write a note, then tick it off."
      actions={
        <>
          <Segmented value={scope} onChange={setScope} options={[{ code: "mine", label: "Mine" }, { code: "all", label: "Whole team" }]} />
          <Segmented value={status} onChange={setStatus} options={[{ code: "open", label: "To do" }, { code: "done", label: "Done" }]} />
        </>
      }
    >
      {status === "open" && rows.length > 0 && (
        <div className="mb-4 flex gap-3 text-sm">
          <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">{overdue} overdue</span>
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800">{today} due today</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">{rows.length - overdue - today} coming up</span>
        </div>
      )}
      <ErrorBox error={q.error ?? done.error} />
      <div className="card overflow-hidden">
        {rows.length === 0 && !q.isLoading && <EmptyState icon={<PhoneCall size={20} />} title={status === "open" ? "Nothing to follow up" : "Nothing done yet"} body="Add a follow-up date when you write a note and it shows up here." />}
        <table className="w-full text-sm">
          {rows.length > 0 && (
            <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
              <tr><th className="px-5 py-3 font-medium">Due</th><th className="font-medium">Patient</th><th className="font-medium">Follow-up</th><th className="font-medium">Who</th><th className="text-right font-medium">Balance</th><th className="px-5" /></tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-3">
                  <span className={t.overdue ? "font-medium text-red-600" : t.dueToday ? "font-medium text-amber-700" : "text-slate-600"}>{isoToDisplay(t.dueDate)}</span>
                  {t.overdue && <Badge tone="red">overdue</Badge>}
                </td>
                <td>
                  {t.patientId ? (
                    <button className="text-left font-medium text-navy-700 hover:underline" onClick={() => nav.openPatient(t.patientId!, t.patientName ?? "Patient", "overview")}>
                      {t.patientName}<span className="ml-1.5 font-mono text-xs text-slate-400">#{t.accountNumber}</span>
                    </button>
                  ) : <span className="text-slate-400">General</span>}
                </td>
                <td className="max-w-md text-slate-700"><span className="line-clamp-2">{t.title}</span></td>
                <td className="text-slate-500">{t.assignedInitials ?? "—"}{status === "done" && t.doneBy ? ` · done by ${t.doneBy}` : ""}</td>
                <td className="text-right"><Money cents={t.balanceCents ?? 0} /></td>
                <td className="px-5 text-right">
                  {status === "open" && <button className="btn btn-sm" onClick={() => done.mutate(t.id)}><Check size={14} /> Done</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
