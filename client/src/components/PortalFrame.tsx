// The frame for both portals: a simple top bar instead of the billing team's sidebar.
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, LogOut } from "lucide-react";
import { del, post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Avatar } from "./ui";

export function PortalFrame<T extends string>({ title, tabs, tab, onTab, children }: { title: string; tabs: { key: T; label: string }[]; tab: T; onTab: (t: T) => void; children: ReactNode }) {
  const s = useSession();
  const qc = useQueryClient();
  const leave = async () => {
    await del("/api/session/view-as");
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    await qc.refetchQueries({ queryKey: ["session"] });
  };
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      {s.viewAs && (
        <div className="flex items-center justify-center gap-3 bg-violet-700 px-4 py-1.5 text-sm text-white">
          <Eye size={15} /> <span><b>{s.viewAs.realName}</b> is viewing as <b>{s.user.name}</b>. Read-only. Reason: “{s.viewAs.reason}”</span>
          <button className="rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25" onClick={leave}>Leave</button>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <div className="flex items-center gap-2.5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-navy-950">C</div>
            <div>
              <div className="text-sm font-semibold leading-tight text-slate-900">{title}</div>
              <div className="text-2xs leading-tight text-slate-500">Billing by Caliber DME Billing</div>
            </div>
          </div>
          <nav className="flex flex-1 gap-1 self-stretch">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => onTab(t.key)} className={`relative px-3 text-sm font-medium ${tab === t.key ? "text-navy-800" : "text-slate-500 hover:text-slate-800"}`}>
                {t.label}
                {tab === t.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-navy-800" />}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Avatar name={s.user.name} size={28} />
            <span className="hidden text-sm text-slate-700 sm:block">{s.user.name}</span>
            <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Log out" onClick={() => post("/api/auth/logout").finally(() => window.location.reload())}><LogOut size={16} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-4 text-center text-2xs text-slate-400">Demo data only: no real patients</footer>
    </div>
  );
}
