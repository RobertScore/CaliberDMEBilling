import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ApiError } from "@/lib/api";
import type { SessionInfo } from "@/lib/types";
import { SessionProvider, useSession } from "@/lib/session";
import { Login } from "@/screens/Login";
import { PatientEntry } from "@/screens/PatientEntry";
import { PatientLedger } from "@/screens/PatientLedger";
import { ChargeEntry } from "@/screens/ChargeEntry";
import { PaymentPosting } from "@/screens/PaymentPosting";
import { AuditLogScreen, CloseBooksScreen } from "@/screens/AdminScreens";
import { PatientPicker } from "@/components/PatientPicker";

type TabKind = "patient" | "ledger" | "charge" | "payment" | "calls" | "audit" | "close";
type Tab = { key: string; kind: TabKind; patientId?: number; patientLabel?: string };

const TAB_NAMES: Record<TabKind, string> = {
  patient: "Patient Entry",
  ledger: "Patient Ledger",
  charge: "Charge Entry",
  payment: "Payment Posting",
  calls: "Call List",
  audit: "Audit Log",
  close: "Close Books",
};

// Shortcuts from the spec (MAIN SCREEN tab). On a Mac, Ctrl+letter is free. Alt+letter also works everywhere.
const SHORTCUTS: Record<string, TabKind> = { r: "patient", l: "ledger", k: "charge", p: "payment", o: "calls" };

export default function App() {
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => get<SessionInfo>("/api/session"),
    retry: false,
  });

  useEffect(() => {
    const h = () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      qc.refetchQueries({ queryKey: ["session"] });
    };
    window.addEventListener("cdb:logged-out", h);
    return () => window.removeEventListener("cdb:logged-out", h);
  }, [qc]);

  if (session.isLoading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (session.error instanceof ApiError && session.error.status === 401) return <Login onLoggedIn={() => session.refetch()} />;
  if (!session.data) return <div className="p-6 text-red-700">Can't reach the server. Is it running?</div>;
  return (
    <SessionProvider value={session.data}>
      <Workspace />
    </SessionProvider>
  );
}

function Workspace() {
  const qc = useQueryClient();
  const s = useSession();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const counter = useRef(0);

  const openTab = useCallback((kind: TabKind, patientId?: number, patientLabel?: string) => {
    const key = `${kind}-${++counter.current}`;
    setTabs((t) => [...t, { key, kind, patientId, patientLabel }]);
    setActive(key);
  }, []);
  const closeTab = (key: string) => {
    setTabs((t) => {
      const next = t.filter((x) => x.key !== key);
      if (active === key) setActive(next.at(-1)?.key ?? null);
      return next;
    });
  };
  const updateTab = (key: string, patch: Partial<Tab>) => setTabs((t) => t.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!s.activeClient || e.shiftKey || e.metaKey) return;
      if (!(e.ctrlKey || e.altKey)) return;
      const kind = SHORTCUTS[e.code.replace("Key", "").toLowerCase()];
      if (!kind) return;
      e.preventDefault();
      e.stopPropagation();
      if (kind !== "calls") openTab(kind);
    };
    window.addEventListener("keydown", h, { capture: true });
    return () => window.removeEventListener("keydown", h, { capture: true });
  }, [openTab, s.activeClient]);

  // Log out after 15 idle minutes, warning at 13 (server enforces the same). ASSUMPTION Q-007.
  useEffect(() => {
    let last = Date.now();
    const bump = () => {
      last = Date.now();
      setIdleWarning(false);
    };
    const events = ["mousedown", "keydown", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, bump));
    const t = setInterval(() => {
      const idle = Date.now() - last;
      if (idle > 15 * 60_000) logout();
      else if (idle > 13 * 60_000) setIdleWarning(true);
    }, 15_000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await post("/api/auth/logout").catch(() => undefined);
    qc.clear();
    window.location.reload();
  }

  async function switchClient(id: number) {
    await post("/api/session/client", { clientId: id });
    // Throw away everything from the previous client so nothing can show across clients.
    setTabs([]);
    setActive(null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    await qc.refetchQueries({ queryKey: ["session"] });
  }

  const activeTab = tabs.find((t) => t.key === active);

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex items-center gap-3 bg-navy-800 px-3 py-1.5 text-white">
        <div className="font-bold tracking-wide">Caliber DME Billing</div>
        <select
          className="h-7 rounded border border-navy-600 bg-navy-700 px-2 text-[13px] text-white"
          value={s.activeClient?.id ?? ""}
          onChange={(e) => e.target.value && switchClient(Number(e.target.value))}
        >
          <option value="">Choose a client…</option>
          {s.clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="rounded bg-amber-400 px-1.5 text-[10px] font-bold text-navy-900">DEMO DATA</span>
        <div className="ml-auto text-[12px] text-navy-100">
          {s.user.name} · {s.user.roleLabel}
        </div>
        <button className="rounded border border-navy-600 px-2 py-0.5 text-[12px] hover:bg-navy-700" onClick={logout}>Log out</button>
      </header>

      {s.activeClient && (
        <nav className="no-print flex items-center gap-1 border-b border-slate-300 bg-white px-2 py-1">
          <Menu label="File" items={[{ label: "Log out", onClick: logout }, { label: "Users & permissions", phase: 2 }]} />
          <Menu label="Pat" items={[{ label: "Register new patient", key: "Ctrl+R", onClick: () => openTab("patient") }, { label: "Find / edit patient", onClick: () => openTab("patient", -1) }]} />
          <Menu
            label="Tran"
            items={[
              { label: "Patient ledger", key: "Ctrl+L", onClick: () => openTab("ledger") },
              { label: "Charge entry", key: "Ctrl+K", onClick: () => openTab("charge"), disabled: !s.can("charge.post") },
              { label: "Payment posting", key: "Ctrl+P", onClick: () => openTab("payment"), disabled: !s.can("payment.post") },
              { label: "Close books", onClick: () => openTab("close"), disabled: !s.can("period.close") },
            ]}
          />
          <Menu label="Bills" items={[{ label: "CMS-1500 claim forms", phase: 2 }, { label: "Statements", phase: 2 }, { label: "Work Comp: RFA / Second Bill Review", phase: 3 }]} />
          <Menu label="Elec" items={[{ label: "New primary / secondary claims (837P)", phase: 2 }, { label: "ERA 835 downloads", phase: 5 }]} />
          <Menu label="Data" items={[{ label: "Payers, providers, facilities", phase: 2 }, { label: "Procedure codes & fee schedules", phase: 2 }, { label: "Rules library", phase: 3 }]} />
          <Menu label="Reports" items={[{ label: "Audit log", onClick: () => openTab("audit"), disabled: !s.can("audit.view") }, { label: "Daily activity / Aging / Monthly receivables", phase: 4 }]} />
          <div className="mx-2 h-5 w-px bg-slate-300" />
          <ToolButton label="Patient Entry" k="R" onClick={() => openTab("patient")} />
          <ToolButton label="Ledger" k="L" onClick={() => openTab("ledger")} />
          <ToolButton label="Charges" k="K" onClick={() => openTab("charge")} disabled={!s.can("charge.post")} />
          <ToolButton label="Payments" k="P" onClick={() => openTab("payment")} disabled={!s.can("payment.post")} />
          <ToolButton label="Call List" k="O" disabled title="Phase 2" />
        </nav>
      )}

      {tabs.length > 0 && (
        <div className="no-print flex gap-0.5 overflow-x-auto border-b border-slate-300 bg-slate-200 px-2 pt-1">
          {tabs.map((t) => (
            <div
              key={t.key}
              className={`flex cursor-pointer items-center gap-2 rounded-t border border-b-0 px-3 py-1 text-[12px] ${t.key === active ? "border-slate-300 bg-slate-100 font-semibold" : "border-transparent text-slate-600 hover:bg-slate-100"}`}
              onClick={() => setActive(t.key)}
            >
              {TAB_NAMES[t.kind]}
              {t.patientLabel && <span className="font-normal text-slate-500">· {t.patientLabel}</span>}
              <button className="text-slate-400 hover:text-red-700" onClick={(e) => { e.stopPropagation(); closeTab(t.key); }} aria-label="Close tab">✕</button>
            </div>
          ))}
        </div>
      )}

      {idleWarning && <div className="bg-amber-100 px-3 py-1 text-center text-[12px] text-amber-900">You'll be logged out in about 2 minutes for inactivity. Move the mouse or press a key to stay signed in.</div>}

      <main className="flex-1 overflow-y-auto">
        {!s.activeClient ? (
          <Home>
            <div className="text-lg font-semibold text-navy-800">Choose a client to start</div>
            <div className="text-slate-600">Each client's data is kept in its own separate database. You can only see one client at a time.</div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {s.clients.map((c) => <button key={c.id} className="btn" onClick={() => switchClient(c.id)}>{c.name}</button>)}
              {s.clients.length === 0 && <div className="text-red-700">You aren't assigned to any clients yet.</div>}
            </div>
          </Home>
        ) : !activeTab ? (
          <Home>
            <div className="text-lg font-semibold text-navy-800">{s.activeClient.name}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-[12px] text-slate-600">
              <span>Patient Entry</span><span><span className="kbd">Ctrl</span>+<span className="kbd">R</span></span>
              <span>Patient Ledger</span><span><span className="kbd">Ctrl</span>+<span className="kbd">L</span></span>
              <span>Charge Entry</span><span><span className="kbd">Ctrl</span>+<span className="kbd">K</span></span>
              <span>Payment Posting</span><span><span className="kbd">Ctrl</span>+<span className="kbd">P</span></span>
              <span>Call List</span><span><span className="kbd">Ctrl</span>+<span className="kbd">O</span> <span className="text-slate-400">(Phase 2)</span></span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Alt + the same letter also works.</div>
          </Home>
        ) : (
          tabs.map((t) => (
            <div key={t.key} className={t.key === active ? "" : "hidden"}>
              <TabBody tab={t} update={(p) => updateTab(t.key, p)} openTab={openTab} />
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function TabBody({ tab, update, openTab }: { tab: Tab; update: (p: Partial<Tab>) => void; openTab: (k: TabKind, id?: number, label?: string) => void }) {
  const needsPatient = tab.kind === "ledger" || tab.kind === "charge" || tab.kind === "payment" || (tab.kind === "patient" && tab.patientId === -1);
  if (needsPatient && (!tab.patientId || tab.patientId < 0)) {
    return <PatientPicker title={`${TAB_NAMES[tab.kind]}: find a patient`} onPick={(p) => update({ patientId: p.id, patientLabel: `${p.lastName}, ${p.firstName}` })} />;
  }
  const label = (id: number) => tab.patientLabel ?? `#${id}`;
  switch (tab.kind) {
    case "patient":
      return <PatientEntry patientId={tab.patientId} onSaved={(id, l) => update({ patientId: id || undefined, patientLabel: l })} />;
    case "ledger":
      return <PatientLedger patientId={tab.patientId!} open={(k, id) => openTab(k === "patient" ? "patient" : k, id, label(id))} />;
    case "charge":
      return <ChargeEntry patientId={tab.patientId!} openLedger={(id) => openTab("ledger", id, label(id))} />;
    case "payment":
      return <PaymentPosting patientId={tab.patientId!} openLedger={(id) => openTab("ledger", id, label(id))} />;
    case "audit":
      return <AuditLogScreen />;
    case "close":
      return <CloseBooksScreen />;
    default:
      return <div className="p-6 text-slate-500">Coming in a later phase.</div>;
  }
}

function Home({ children }: { children: ReactNode }) {
  // Spec: "MAIN SCREEN HAS CLOUD IMAGE ONLY, UNTIL YOU START A FUNCTION".
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-white">
      <svg className="absolute left-[8%] top-[12%] w-64 opacity-90" viewBox="0 0 200 80" aria-hidden><path fill="white" d="M40 70h120a25 25 0 0 0 0-50 35 35 0 0 0-65-8A28 28 0 0 0 40 70z" /></svg>
      <svg className="absolute right-[10%] top-[30%] w-80 opacity-80" viewBox="0 0 200 80" aria-hidden><path fill="white" d="M40 70h120a25 25 0 0 0 0-50 35 35 0 0 0-65-8A28 28 0 0 0 40 70z" /></svg>
      <svg className="absolute bottom-[12%] left-[30%] w-72 opacity-70" viewBox="0 0 200 80" aria-hidden><path fill="white" d="M40 70h120a25 25 0 0 0 0-50 35 35 0 0 0-65-8A28 28 0 0 0 40 70z" /></svg>
      <div className="relative rounded-xl bg-white/80 px-8 py-6 text-center shadow-sm backdrop-blur">{children}</div>
    </div>
  );
}

type MenuItem = { label: string; onClick?: () => void; key?: string; disabled?: boolean; phase?: number };
function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button className="rounded px-2 py-0.5 text-[13px] hover:bg-slate-100" onClick={() => setOpen((o) => !o)}>{label}</button>
      {open && (
        <div className="absolute left-0 z-40 min-w-64 rounded border border-slate-300 bg-white py-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              className="flex w-full items-center justify-between gap-4 px-3 py-1 text-left text-[13px] hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
              disabled={it.disabled || !!it.phase}
              onClick={() => { setOpen(false); it.onClick?.(); }}
            >
              <span>{it.label}</span>
              <span className="text-[11px] text-slate-400">{it.phase ? `Phase ${it.phase}` : it.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, k, onClick, disabled, title }: { label: string; k: string; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button className="btn h-6 px-2 text-[12px]" onClick={onClick} disabled={disabled} title={title ?? `Ctrl+${k}`}>
      {label} <span className="kbd">^{k}</span>
    </button>
  );
}
