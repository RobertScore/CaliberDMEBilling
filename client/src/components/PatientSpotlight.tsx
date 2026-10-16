// Quick patient search ("spotlight"). Type a name or account number, arrow keys to move, Enter to open.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, CornerDownLeft } from "lucide-react";
import { get } from "@/lib/api";
import type { PatientSummary } from "@/lib/types";
import { isoToDisplay } from "@shared/dates";
import { Avatar, CoverageBadge } from "./ui";
import { Money } from "./inputs";

export function PatientSpotlight({ purpose, onPick, onClose, onNew }: { purpose: string; onPick: (p: PatientSummary) => void; onClose: () => void; onNew?: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const { data, isFetching } = useQuery({
    queryKey: ["patients", q],
    queryFn: () => get<PatientSummary[]>(`/api/patients?q=${encodeURIComponent(q)}`),
  });
  const list = data ?? [];
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className="card w-full max-w-xl overflow-hidden shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-navy-500">{purpose}</div>
          <div className="flex items-center gap-3">
            <Search size={20} className="text-slate-400" />
            <input
              autoFocus
              className="h-10 w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Search by last name, LAST, FIRST, or account #"
              value={q}
              onChange={(e) => setQ(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                if (e.key === "Enter" && list[sel]) onPick(list[sel]);
              }}
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {list.map((p, i) => (
            <button
              key={p.id}
              onMouseEnter={() => setSel(i)}
              onClick={() => onPick(p)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${i === sel ? "bg-navy-50" : "hover:bg-slate-50"}`}
            >
              <Avatar name={`${p.lastName}, ${p.firstName}`} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">
                  {p.lastName}, {p.firstName}
                </div>
                <div className="text-xs text-slate-500">
                  #{p.accountNumber} · DOB {isoToDisplay(p.dob)}
                </div>
              </div>
              <CoverageBadge type={p.coverageType} />
              {p.balanceCents !== undefined && <Money cents={p.balanceCents} className="w-24 text-right text-sm text-slate-700" />}
              {i === sel && <CornerDownLeft size={14} className="text-slate-400" />}
            </button>
          ))}
          {!isFetching && list.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-500">No patients match “{q}”.</div>}
        </div>
        {onNew && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
            <span>
              <span className="kbd">↑</span> <span className="kbd">↓</span> to move · <span className="kbd">Enter</span> to open · <span className="kbd">Esc</span> to close
            </span>
            <button className="btn btn-sm" onClick={onNew}>
              <UserPlus size={14} /> New patient
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
