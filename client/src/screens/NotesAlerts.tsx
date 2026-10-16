// Account notes (permanent, from the spec: "EVERY ACTION IN ACCOUNT MUST BE NOTED BY EMPLOYEE" and
// "NOTES CANNOT BE LATER EDITED OR REMOVED") and alerts (shown on open; removable).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, Lock, MessageSquareText, Trash2 } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { ListItem, Note, Overview } from "@/lib/types";
import { Avatar, Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox } from "@/components/inputs";
import { NoteComposer } from "@/components/NoteComposer";
import { isoToDisplay } from "@shared/dates";

type Alert = { id: number; body: string; createdAt: string; createdBy: string };

export function NotesAlerts({ patientId, alerts, overview }: { patientId: number; alerts: Alert[]; overview?: Overview }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useSession();
  const [alertBody, setAlertBody] = useState("");
  const notes = useQuery({ queryKey: ["notes", patientId], queryFn: () => get<Note[]>(`/api/patients/${patientId}/notes`) });
  const categories = useQuery({ queryKey: ["lists", "note_category"], queryFn: () => get<ListItem[]>("/api/lists/note_category"), staleTime: 60_000 });
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const label = (code: string) => categories.data?.find((c) => c.code === code)?.label ?? code;
  const shown = useMemo(
    () => (notes.data ?? []).filter((n) => (!cat || n.category === cat) && (!q || `${n.body} ${n.createdBy}`.toLowerCase().includes(q.toLowerCase()))),
    [notes.data, cat, q],
  );
  const refreshAlerts = () => qc.invalidateQueries({ queryKey: ["alerts", patientId] });
  const addAlert = useMutation({ mutationFn: () => post(`/api/patients/${patientId}/alerts`, { body: alertBody }), onSuccess: () => { setAlertBody(""); refreshAlerts(); toast("Alert added. It will pop up whenever this account is opened."); } });
  const removeAlert = useMutation({ mutationFn: (id: number) => del(`/api/patients/${patientId}/alerts/${id}`), onSuccess: () => { refreshAlerts(); toast("Alert removed."); } });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Account notes</div>
          <span className="flex items-center gap-1 text-2xs text-slate-400"><Lock size={12} /> Notes are permanent</span>
        </div>
        {can("note.create") && (
          <div className="border-b border-slate-100 p-5">
            <NoteComposer patientId={patientId} overview={overview} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-5 py-3">
          <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <input className="input h-8 w-56 text-xs" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="ml-auto text-2xs text-slate-400">{shown.length} of {notes.data?.length ?? 0}</span>
        </div>
        {notes.data?.length === 0 && <EmptyState icon={<MessageSquareText size={20} />} title="No notes yet" body="Every action on the account should be noted here." />}
        <ol className="divide-y divide-slate-50">
          {shown.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-4">
              <Avatar name={n.createdBy} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-600">{n.createdBy}</span> · {new Date(n.createdAt).toLocaleString()}
                  <Badge tone="slate">{label(n.category)}</Badge>
                  {n.followUpDate && <span className="flex items-center gap-0.5 text-navy-600"><CalendarClock size={11} /> follow up {isoToDisplay(n.followUpDate)}</span>}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{n.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card self-start">
        <div className="card-head"><div className="card-title">Alerts</div></div>
        <div className="space-y-2 p-5">
          <p className="text-xs text-slate-500">Alerts pop up as soon as anyone opens this account.</p>
          {alerts.map((a) => (
            <div key={a.id} className="group flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <BellRing size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">{a.body}</div>
                <div className="mt-0.5 text-2xs text-slate-500">{new Date(a.createdAt).toLocaleDateString()} · {a.createdBy}</div>
              </div>
              {can("alert.manage") && (
                <button className="self-start rounded p-1 text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100" onClick={() => removeAlert.mutate(a.id)} aria-label="Remove alert"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          {alerts.length === 0 && <div className="py-2 text-sm text-slate-400">No alerts on this account.</div>}
          {can("alert.manage") && (
            <div className="flex gap-2 pt-2">
              <input className="input" placeholder="New alert…" value={alertBody} onChange={(e) => setAlertBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && alertBody.trim() && addAlert.mutate()} />
              <button className="btn shrink-0" disabled={!alertBody.trim()} onClick={() => addAlert.mutate()}>Add</button>
            </div>
          )}
          <ErrorBox error={addAlert.error ?? removeAlert.error} />
        </div>
      </div>
    </div>
  );
}
