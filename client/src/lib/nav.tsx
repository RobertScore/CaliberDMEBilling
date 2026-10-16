// Where the user is. Patients open as tabs that stay open (and keep their place) while you work on others.
// Two patients can be shown side by side.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type Section = "overview" | "activity" | "documents" | "charge" | "payment" | "details" | "notes";
export type Screen = "home" | "inbox" | "calls" | "patients" | "new-patient" | "reports" | "audit" | "close" | "users" | "settings";
export type PatientTab = { id: number; label: string; section: Section };
export type View = { name: Screen } | { name: "intake"; id: number } | { name: "patient"; id: number };

type Nav = {
  view: View;
  go: (v: View) => void;
  tabs: PatientTab[];
  openPatient: (id: number, label: string, section?: Section) => void;
  setSection: (id: number, section: Section) => void;
  closeTab: (id: number) => void;
  split: number | null; // patient shown on the right in side-by-side view
  setSplit: (id: number | null) => void;
  pickPatient: (purpose: string, then: (id: number, label: string) => void) => void;
  picker: { purpose: string; then: (id: number, label: string) => void } | null;
  closePicker: () => void;
  reset: () => void;
};

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: "home" });
  const [tabs, setTabs] = useState<PatientTab[]>([]);
  const [split, setSplitState] = useState<number | null>(null);
  const [picker, setPicker] = useState<Nav["picker"]>(null);

  const openPatient = useCallback((id: number, label: string, section?: Section) => {
    setTabs((t) => {
      const existing = t.find((x) => x.id === id);
      if (existing) return t.map((x) => (x.id === id ? { ...x, label, section: section ?? x.section } : x));
      return [...t, { id, label, section: section ?? "overview" }];
    });
    setView({ name: "patient", id });
  }, []);

  const value: Nav = {
    view,
    go: setView,
    tabs,
    openPatient,
    setSection: (id, section) => setTabs((t) => t.map((x) => (x.id === id ? { ...x, section } : x))),
    closeTab: (id) => {
      setTabs((t) => {
        const next = t.filter((x) => x.id !== id);
        setView((v) => (v.name === "patient" && v.id === id ? (next.length ? { name: "patient", id: next[next.length - 1].id } : { name: "home" }) : v));
        return next;
      });
      setSplitState((s) => (s === id ? null : s));
    },
    split,
    setSplit: setSplitState,
    pickPatient: (purpose, then) => setPicker({ purpose, then }),
    picker,
    closePicker: () => setPicker(null),
    reset: () => {
      setTabs([]);
      setSplitState(null);
      setPicker(null);
      setView({ name: "home" });
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const n = useContext(Ctx);
  if (!n) throw new Error("useNav outside NavProvider");
  return n;
}
