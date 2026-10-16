import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ArrowRight } from "lucide-react";
import { get, post, ApiError } from "@/lib/api";
import type { SessionInfo } from "@/lib/types";
import { SessionProvider, useSession } from "@/lib/session";
import { NavProvider, useNav } from "@/lib/nav";
import { Shell, Page } from "@/components/Shell";
import { ToastProvider } from "@/components/ui";
import { PatientSpotlight } from "@/components/PatientSpotlight";
import { Login } from "@/screens/Login";
import { Home } from "@/screens/Home";
import { Patients } from "@/screens/Patients";
import { PatientWorkspace } from "@/screens/PatientWorkspace";
import { PatientForm } from "@/screens/PatientForm";
import { AuditLogScreen, CloseBooksScreen } from "@/screens/AdminScreens";

export default function App() {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: () => get<SessionInfo>("/api/session"), retry: false });

  useEffect(() => {
    const h = () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      qc.refetchQueries({ queryKey: ["session"] });
    };
    window.addEventListener("cdb:logged-out", h);
    return () => window.removeEventListener("cdb:logged-out", h);
  }, [qc]);

  if (session.isLoading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  if (session.error instanceof ApiError && session.error.status === 401) return <Login onLoggedIn={() => session.refetch()} />;
  if (!session.data) return <div className="p-10 text-red-700">Can't reach the server. Is it running?</div>;
  return (
    <SessionProvider value={session.data}>
      <ToastProvider>
        <NavProvider>
          <Workspace />
        </NavProvider>
      </ToastProvider>
    </SessionProvider>
  );
}

function Workspace() {
  const qc = useQueryClient();
  const s = useSession();
  const nav = useNav();
  const [idleWarning, setIdleWarning] = useState(false);

  // Keyboard shortcuts from the spec (MAIN SCREEN tab). Alt + the same letter also works.
  // If a patient is already open, the shortcut goes straight to that patient.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!s.activeClient || nav.picker) return;
      const typing = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        nav.pickPatient("Open a patient", (id, l) => nav.openPatient(id, l));
        return;
      }
      if (!(e.ctrlKey || e.altKey) || e.shiftKey || e.metaKey) return;
      const k = e.code.replace("Key", "").toLowerCase();
      const v = nav.view;
      const withPatient = (section: "activity" | "charge" | "payment", purpose: string) =>
        v.name === "patient" ? nav.go({ ...v, section }) : nav.pickPatient(purpose, (id, l) => nav.openPatient(id, l, section));
      const actions: Record<string, () => void> = {
        r: () => s.can("patient.create") && nav.go({ name: "new-patient" }),
        l: () => withPatient("activity", "Open the ledger for…"),
        k: () => s.can("charge.post") && withPatient("charge", "Post charges for…"),
        p: () => s.can("payment.post") && withPatient("payment", "Post a payment for…"),
      };
      if (!actions[k]) return;
      e.preventDefault();
      e.stopPropagation();
      actions[k]();
    };
    window.addEventListener("keydown", h, { capture: true });
    return () => window.removeEventListener("keydown", h, { capture: true });
  }, [s, nav]);

  // Log out after 15 idle minutes, warning at 13 (the server enforces the same). ASSUMPTION Q-007.
  useEffect(() => {
    let last = Date.now();
    const bump = () => { last = Date.now(); setIdleWarning(false); };
    const events = ["mousedown", "keydown", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, bump));
    const t = setInterval(() => {
      const idle = Date.now() - last;
      if (idle > 15 * 60_000) logout();
      else if (idle > 13 * 60_000) setIdleWarning(true);
    }, 15_000);
    return () => { events.forEach((ev) => window.removeEventListener(ev, bump)); clearInterval(t); };
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
    nav.reset();
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    await qc.refetchQueries({ queryKey: ["session"] });
  }

  const v = nav.view;
  let screen;
  if (!s.activeClient) {
    screen = (
      <Page title="Choose a client" subtitle="Each client's data is kept in its own separate database. You work in one client at a time." width="max-w-3xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {s.clients.map((c) => (
            <button key={c.id} className="card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => switchClient(c.id)}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700"><Building2 size={20} /></span>
              <span className="flex-1 font-semibold text-slate-900">{c.name}</span>
              <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-navy-700" />
            </button>
          ))}
          {s.clients.length === 0 && <div className="text-red-700">You aren't assigned to any clients yet. Ask a manager.</div>}
        </div>
      </Page>
    );
  } else if (v.name === "home") screen = <Home />;
  else if (v.name === "patients") screen = <Patients />;
  else if (v.name === "new-patient")
    screen = (
      <Page title="Register a patient" subtitle="Start with the essentials. Everything else is under “More details”." width="max-w-5xl">
        <PatientForm onSaved={(id, label) => nav.openPatient(id, label, "charge")} onCancel={() => nav.go({ name: "home" })} />
      </Page>
    );
  else if (v.name === "patient") screen = <PatientWorkspace key={v.id} id={v.id} section={v.section} />;
  else if (v.name === "audit") screen = <AuditLogScreen />;
  else if (v.name === "close") screen = <CloseBooksScreen />;

  return (
    <Shell onSwitchClient={switchClient} onLogout={logout}>
      {idleWarning && (
        <div className="sticky top-0 z-30 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          You'll be signed out in about 2 minutes for inactivity. Move the mouse or press a key to stay signed in.
        </div>
      )}
      {screen}
      {nav.picker && (
        <PatientSpotlight
          purpose={nav.picker.purpose}
          onClose={nav.closePicker}
          onNew={s.can("patient.create") ? () => { nav.closePicker(); nav.go({ name: "new-patient" }); } : undefined}
          onPick={(p) => {
            const then = nav.picker!.then;
            nav.closePicker();
            then(p.id, `${p.lastName}, ${p.firstName}`);
          }}
        />
      )}
    </Shell>
  );
}
