// The frame around every staff screen: a sidebar organized by the billing workflow,
// and a tab bar of open patients across the top (many patients open at once).
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, UserPlus, ScrollText, Lock, LogOut, ChevronsUpDown, X, Building2, Check, Users, Inbox, PhoneCall, BarChart3, Settings, UserCog, Columns2, Eye } from "lucide-react";
import { get } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useNav, type Screen } from "@/lib/nav";
import { Avatar } from "./ui";

function NavItem({ icon, label, active, onClick, shortcut, disabled, title, count, countTone = "accent" }: { icon: ReactNode; label: string; active?: boolean; onClick?: () => void; shortcut?: string; disabled?: boolean; title?: string; count?: number; countTone?: "accent" | "red" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      <span className={active ? "text-accent-300" : "text-navy-300 group-hover:text-navy-100"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {!!count && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${countTone === "red" ? "bg-red-500 text-white" : "bg-accent-400 text-navy-950"}`}>{count}</span>}
      {shortcut && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-navy-300">{shortcut}</span>}
    </button>
  );
}

/** Open patients, like browser tabs. Each keeps its own place. */
function PatientTabs() {
  const nav = useNav();
  const v = nav.view;
  if (nav.tabs.length === 0) return null;
  return (
    <div className="no-print sticky top-0 z-20 flex items-end gap-1 overflow-x-auto border-b border-slate-200 bg-white/95 px-3 pt-2 backdrop-blur">
      {nav.tabs.map((t) => {
        const active = v.name === "patient" && v.id === t.id;
        const inSplit = nav.split === t.id;
        return (
          <div
            key={t.id}
            className={`group flex max-w-[220px] shrink-0 items-center rounded-t-lg border border-b-0 ${active ? "border-slate-200 bg-canvas" : inSplit ? "border-navy-100 bg-navy-50/60" : "border-transparent hover:bg-slate-50"}`}
          >
            <button className="flex min-w-0 items-center gap-2 py-1.5 pl-2.5 pr-1 text-left" onClick={() => nav.openPatient(t.id, t.label)} title={t.label}>
              <Avatar name={t.label} size={20} />
              <span className={`truncate text-xs ${active ? "font-semibold text-slate-900" : "text-slate-600"}`}>{t.label}</span>
              {inSplit && <Columns2 size={11} className="shrink-0 text-navy-500" />}
            </button>
            <button className="mr-1 rounded p-0.5 text-slate-300 hover:bg-slate-200 hover:text-slate-700" onClick={() => nav.closeTab(t.id)} aria-label={`Close ${t.label}`}>
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button className="mb-1 ml-1 shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => nav.pickPatient("Open a patient", (id, l) => nav.openPatient(id, l))} title="Open another patient (/)">
        + Open patient
      </button>
      {nav.tabs.length > 1 && (
        <button className="mb-1 ml-auto shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => nav.tabs.forEach((t) => nav.closeTab(t.id))}>
          Close all
        </button>
      )}
    </div>
  );
}

export function Shell({ children, onSwitchClient, onLogout, onLeaveViewAs }: { children: ReactNode; onSwitchClient: (id: number) => void; onLogout: () => void; onLeaveViewAs: () => void }) {
  const s = useSession();
  const nav = useNav();
  const [clientMenu, setClientMenu] = useState(false);
  const v = nav.view;
  const on = !!s.activeClient;
  const inbox = useQuery({ queryKey: ["intake", "count"], queryFn: () => get<{ open: number }>("/api/intake/count"), enabled: on && s.can("intake.process"), refetchInterval: 60_000 });
  const calls = useQuery({ queryKey: ["tasks", "summary"], queryFn: () => get<{ dueNow: number }>("/api/tasks/summary"), enabled: on && s.can("task.manage"), refetchInterval: 60_000 });
  const goto = (name: Screen) => nav.go({ name });

  return (
    <div className="flex h-full flex-col">
      {s.viewAs && (
        <div className="no-print flex items-center justify-center gap-3 bg-violet-700 px-4 py-1.5 text-sm text-white">
          <Eye size={15} />
          <span>
            <b>{s.viewAs.realName}</b> is viewing as <b>{s.user.name}</b> ({s.user.roleLabel}). Read-only: nothing can be changed. Reason: “{s.viewAs.reason}”
          </span>
          <button className="rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25" onClick={onLeaveViewAs}>Leave</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="no-print flex w-60 shrink-0 flex-col bg-navy-900 text-white">
          <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-navy-950">C</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Caliber</div>
              <div className="text-2xs leading-tight text-navy-300">DME Billing</div>
            </div>
          </div>

          <div className="relative px-3">
            <button className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/10" onClick={() => setClientMenu((o) => !o)}>
              <Building2 size={16} className="text-accent-300" />
              <div className="min-w-0 flex-1">
                <div className="text-2xs uppercase tracking-wider text-navy-300">Client</div>
                <div className="truncate text-sm font-medium">{s.activeClient?.name ?? "Choose a client"}</div>
              </div>
              <ChevronsUpDown size={14} className="text-navy-300" />
            </button>
            {clientMenu && (
              <div className="absolute left-3 right-3 z-40 mt-1 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-lift" onMouseLeave={() => setClientMenu(false)}>
                {s.clients.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setClientMenu(false);
                      if (c.id !== s.activeClient?.id) onSwitchClient(c.id);
                    }}
                  >
                    <span className="flex-1">{c.name}</span>
                    {c.id === s.activeClient?.id && <Check size={14} className="text-accent-600" />}
                  </button>
                ))}
                <div className="px-3 pb-1 pt-2 text-2xs text-slate-400">Each client is a separate, locked-off database. Switching closes open patients.</div>
              </div>
            )}
          </div>

          {on && (
            <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-3">
              <div className="space-y-0.5">
                <NavItem icon={<Home size={18} />} label="Home" active={v.name === "home"} onClick={() => goto("home")} />
                <NavItem icon={<Inbox size={18} />} label="Inbox" active={v.name === "inbox" || v.name === "intake"} onClick={() => goto("inbox")} disabled={!s.can("intake.process")} count={inbox.data?.open} title="New faxes, emails and uploads to file" />
                <NavItem icon={<PhoneCall size={18} />} label="Call list" shortcut="⌃O" active={v.name === "calls"} onClick={() => goto("calls")} disabled={!s.can("task.manage")} count={calls.data?.dueNow} countTone="red" title="Follow-ups due" />
              </div>

              <div>
                <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Patients</div>
                <div className="space-y-0.5">
                  <NavItem icon={<Search size={18} />} label="Find a patient" shortcut="/" onClick={() => nav.pickPatient("Open a patient", (id, l) => nav.openPatient(id, l))} />
                  <NavItem icon={<UserPlus size={18} />} label="Register patient" shortcut="⌃R" active={v.name === "new-patient"} onClick={() => goto("new-patient")} disabled={!s.can("patient.create")} />
                  <NavItem icon={<Users size={18} />} label="All patients" active={v.name === "patients"} onClick={() => goto("patients")} />
                </div>
              </div>

              <div>
                <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Office</div>
                <div className="space-y-0.5">
                  <NavItem icon={<BarChart3 size={18} />} label="Reports" active={v.name === "reports"} onClick={() => goto("reports")} disabled={!s.can("report.view")} />
                  <NavItem icon={<Lock size={18} />} label="Close the books" active={v.name === "close"} onClick={() => goto("close")} disabled={!s.can("period.close")} />
                  <NavItem icon={<ScrollText size={18} />} label="Audit log" active={v.name === "audit"} onClick={() => goto("audit")} disabled={!s.can("audit.view")} />
                </div>
              </div>

              {(s.can("users.manage") || s.can("settings.manage")) && (
                <div>
                  <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Admin</div>
                  <div className="space-y-0.5">
                    <NavItem icon={<UserCog size={18} />} label="Users & access" active={v.name === "users"} onClick={() => goto("users")} disabled={!s.can("users.manage")} />
                    <NavItem icon={<Settings size={18} />} label="Settings" active={v.name === "settings"} onClick={() => goto("settings")} disabled={!s.can("settings.manage")} />
                  </div>
                </div>
              )}
            </nav>
          )}
          {!on && <div className="flex-1" />}

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar name={s.user.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.user.name}</div>
                <div className="truncate text-2xs text-navy-300">{s.user.roleLabel}</div>
              </div>
              <button className="rounded-md p-1.5 text-navy-300 hover:bg-white/10 hover:text-white" onClick={onLogout} title="Log out">
                <LogOut size={16} />
              </button>
            </div>
            <div className="mt-1 rounded-md bg-amber-400/10 px-3 py-1.5 text-center text-2xs font-medium text-amber-300">Demo data only: no real patients</div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {on && <PatientTabs />}
          <div className="min-h-0 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Standard page container with a title row. */
export function Page({ title, subtitle, actions, children, width = "max-w-6xl" }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; width?: string }) {
  return (
    <div className={`mx-auto w-full ${width} px-8 py-8`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
