// Account notes (permanent, from the spec: "EVERY ACTION IN ACCOUNT MUST BE NOTED BY EMPLOYEE" and
// "NOTES CANNOT BE LATER EDITED OR REMOVED") and alerts (shown on open; removable).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Lock, MessageSquareText, Send, Trash2 } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Avatar, EmptyState, useToast } from "@/components/ui";
import { ErrorBox } from "@/components/inputs";

type Note = { id: number; body: string; createdAt: string; createdBy: string };

export function NotesAlerts({ patientId, alerts }: { patientId: number; alerts: Note[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useSession();
  const [body, setBody] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const notes = useQuery({ queryKey: ["notes", patientId], queryFn: () => get<Note[]>(`/api/patients/${patientId}/notes`) });
  const addNote = useMutation({
    mutationFn: () => post(`/api/patients/${patientId}/notes`, { body }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["notes", patientId] }); toast("Note added."); },
  });
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
            <textarea
              className="input h-24 resize-none py-2.5"
              placeholder="What did you do on this account? Calls, emails received, requests sent…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) addNote.mutate(); }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xs text-slate-400">Press ⌘/Ctrl + Enter to add</span>
              <button className="btn btn-primary btn-sm" disabled={!body.trim() || addNote.isPending} onClick={() => addNote.mutate()}><Send size={13} /> Add note</button>
            </div>
            <div className="mt-2"><ErrorBox error={addNote.error} /></div>
          </div>
        )}
        {notes.data?.length === 0 && <EmptyState icon={<MessageSquareText size={20} />} title="No notes yet" body="Every action on the account should be noted here." />}
        <ol className="divide-y divide-slate-50">
          {notes.data?.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-4">
              <Avatar name={n.createdBy} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-400"><span className="font-medium text-slate-600">{n.createdBy}</span> · {new Date(n.createdAt).toLocaleString()}</div>
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
