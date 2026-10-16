// The frame around every screen: a sidebar organized by the billing workflow.
import { useState, type ReactNode } from "react";
import { Home, Search, UserPlus, Receipt, Wallet, ScrollText, Lock, LogOut, ChevronsUpDown, X, Building2, Check, Users } from "lucide-react";
import { useSession } from "@/lib/session";
import { useNav } from "@/lib/nav";
import { Avatar } from "./ui";

function NavItem({ icon, label, active, onClick, shortcut, disabled, title }: { icon: ReactNode; label: string; active?: boolean; onClick?: () => void; shortcut?: string; disabled?: boolean; title?: string }) {
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
      {shortcut && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-navy-300">{shortcut}</span>}
    </button>
  );
}

export function Shell({ children, onSwitchClient, onLogout }: { children: ReactNode; onSwitchClient: (id: number) => void; onLogout: () => void }) {
  const s = useSession();
  const nav = useNav();
  const [clientMenu, setClientMenu] = useState(false);
  const v = nav.view;

  const startCharge = () => (v.name === "patient" ? nav.go({ ...v, section: "charge" }) : nav.pickPatient("Post charges for…", (id, l) => nav.openPatient(id, l, "charge")));
  const startPayment = () => (v.name === "patient" ? nav.go({ ...v, section: "payment" }) : nav.pickPatient("Post a payment for…", (id, l) => nav.openPatient(id, l, "payment")));

  return (
    <div className="flex h-full">
      <aside className="no-print flex w-64 shrink-0 flex-col bg-navy-900 text-white">
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
              <div className="px-3 pb-1 pt-2 text-2xs text-slate-400">Each client is a separate, locked-off database.</div>
            </div>
          )}
        </div>

        {s.activeClient && (
          <nav className="mt-5 flex-1 space-y-6 overflow-y-auto px-3">
            <div className="space-y-0.5">
              <NavItem icon={<Home size={18} />} label="Home" active={v.name === "home"} onClick={() => nav.go({ name: "home" })} />
              <NavItem icon={<Search size={18} />} label="Find a patient" shortcut="/" active={v.name === "patients"} onClick={() => nav.go({ name: "patients" })} />
            </div>

            <div>
              <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Workflow</div>
              <div className="space-y-0.5">
                <NavItem icon={<UserPlus size={18} />} label="Register patient" shortcut="⌃R" active={v.name === "new-patient"} onClick={() => nav.go({ name: "new-patient" })} disabled={!s.can("patient.create")} />
                <NavItem icon={<Receipt size={18} />} label="Post charges" shortcut="⌃K" active={v.name === "patient" && v.section === "charge"} onClick={startCharge} disabled={!s.can("charge.post")} />
                <NavItem icon={<Wallet size={18} />} label="Post a payment" shortcut="⌃P" active={v.name === "patient" && v.section === "payment"} onClick={startPayment} disabled={!s.can("payment.post")} />
              </div>
            </div>

            {nav.openAccounts.length > 0 && (
              <div>
                <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Open accounts</div>
                <div className="space-y-0.5">
                  {nav.openAccounts.map((a) => {
                    const active = v.name === "patient" && v.id === a.id;
                    return (
                      <div key={a.id} className={`group flex items-center rounded-lg ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
                        <button className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left" onClick={() => nav.openPatient(a.id, a.label, v.name === "patient" && v.id === a.id ? v.section : "activity")}>
                          <Avatar name={a.label} size={22} />
                          <span className={`truncate text-sm ${active ? "text-white" : "text-navy-200"}`}>{a.label}</span>
                        </button>
                        <button className="mr-1 rounded p-1 text-navy-400 opacity-0 hover:text-white group-hover:opacity-100" onClick={() => nav.closeAccount(a.id)} aria-label="Close account">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-navy-400">Office</div>
              <div className="space-y-0.5">
                <NavItem icon={<Users size={18} />} label="All patients" active={false} onClick={() => nav.go({ name: "patients" })} />
                <NavItem icon={<ScrollText size={18} />} label="Audit log" active={v.name === "audit"} onClick={() => nav.go({ name: "audit" })} disabled={!s.can("audit.view")} />
                <NavItem icon={<Lock size={18} />} label="Close the books" active={v.name === "close"} onClick={() => nav.go({ name: "close" })} disabled={!s.can("period.close")} />
              </div>
            </div>
          </nav>
        )}
        {!s.activeClient && <div className="flex-1" />}

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

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
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
