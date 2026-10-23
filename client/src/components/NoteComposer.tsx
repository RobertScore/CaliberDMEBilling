// Write a note fast: pick a template (patient, payer, claim and today fill in), a category, and an optional follow-up.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText, Send } from "lucide-react";
import { get, post } from "@/lib/api";
import type { ListItem, Overview, Template } from "@/lib/types";
import { useToast } from "./ui";
import { DateInput, ErrorBox } from "./inputs";
import { isoToDisplay, todayIso } from "@shared/dates";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fillTemplate(body: string, o: Overview | undefined) {
  const p = o?.patient;
  const prim = p?.insurances.find((i) => i.rank === 1);
  const values: Record<string, string> = {
    patient: p ? `${p.firstName} ${p.lastName}` : "",
    account: p?.accountNumber ?? "",
    payer: prim?.payerName ?? "",
    claim: prim?.claimNumber ?? "",
    adjuster: prim?.adjusterName ?? "the adjuster",
    today: isoToDisplay(todayIso()),
  };
  return body.replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m);
}

export function NoteComposer({ patientId, overview, compact }: { patientId: number; overview?: Overview; compact?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [followUp, setFollowUp] = useState<string | undefined>();
  const [assignTo, setAssignTo] = useState<number | "">("");
  const [showFollow, setShowFollow] = useState(false);
  const templates = useQuery({ queryKey: ["note-templates"], queryFn: () => get<Template[]>("/api/note-templates"), staleTime: 60_000 });
  const categories = useQuery({ queryKey: ["lists", "note_category"], queryFn: () => get<ListItem[]>("/api/lists/note_category"), staleTime: 60_000 });
  const team = useQuery({ queryKey: ["team"], queryFn: () => get<{ id: number; name: string; initials: string }[]>("/api/team"), staleTime: 60_000, enabled: showFollow });

  const add = useMutation({
    mutationFn: () => post(`/api/patients/${patientId}/notes`, { body, category, followUpDate: followUp, assignToUserId: assignTo || undefined }),
    onSuccess: () => {
      setBody("");
      setFollowUp(undefined);
      setShowFollow(false);
      qc.invalidateQueries({ queryKey: ["overview", patientId] });
      qc.invalidateQueries({ queryKey: ["notes", patientId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast(followUp ? `Note added. Follow-up on ${isoToDisplay(followUp)} is on the Call List.` : "Note added.");
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 max-w-full">
          <FileText size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className="h-8 w-full max-w-full rounded-md border border-slate-200 bg-white pl-7 pr-6 text-xs text-slate-600"
            value=""
            onChange={(e) => {
              const t = templates.data?.find((x) => x.id === Number(e.target.value));
              if (!t) return;
              setBody(fillTemplate(t.body, overview));
              setCategory(t.category);
              if (t.followUpDays) {
                setFollowUp(addDays(todayIso(), t.followUpDays));
                setShowFollow(true);
              }
            }}
          >
            <option value="">Use a template…</option>
            {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.data?.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button type="button" className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs ${showFollow ? "border-navy-300 bg-navy-50 text-navy-800" : "border-slate-200 text-slate-600"}`} onClick={() => setShowFollow((s) => !s)}>
          <CalendarClock size={13} /> Follow-up{followUp ? `: ${isoToDisplay(followUp)}` : ""}
        </button>
      </div>
      {showFollow && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <span className="text-xs text-slate-500">Remind on</span>
          <DateInput value={followUp} onChange={setFollowUp} className="w-40" />
          {[1, 3, 7, 14].map((d) => (
            <button key={d} type="button" className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100" onClick={() => setFollowUp(addDays(todayIso(), d))}>
              +{d}d
            </button>
          ))}
          <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={assignTo} onChange={(e) => setAssignTo(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Assign to me</option>
            {team.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      <textarea
        className={`input resize-none py-2 ${compact ? "h-16" : "h-20"}`}
        placeholder="Add a note: calls, emails, requests sent… (⌘/Ctrl + Enter to save)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) add.mutate();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-2xs text-slate-400">Notes are permanent and can't be edited.</span>
        <button className="btn btn-primary btn-sm" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}>
          <Send size={13} /> Add note
        </button>
      </div>
      <ErrorBox error={add.error} />
    </div>
  );
}
