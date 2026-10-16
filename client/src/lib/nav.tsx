// Where the user is in the app. Workflow-first: almost everything happens inside one patient's workspace.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type Section = "activity" | "charge" | "payment" | "details" | "notes";
export type View =
  | { name: "home" }
  | { name: "patients" }
  | { name: "new-patient" }
  | { name: "patient"; id: number; section: Section }
  | { name: "audit" }
  | { name: "close" };

export type OpenAccount = { id: number; label: string };

type Nav = {
  view: View;
  go: (v: View) => void;
  openPatient: (id: number, label: string, section?: Section) => void;
  openAccounts: OpenAccount[];
  closeAccount: (id: number) => void;
  /** Ask the user to pick a patient, then continue the workflow with them. */
  pickPatient: (purpose: string, then: (id: number, label: string) => void) => void;
  picker: { purpose: string; then: (id: number, label: string) => void } | null;
  closePicker: () => void;
  reset: () => void;
};

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: "home" });
  const [openAccounts, setOpen] = useState<OpenAccount[]>([]);
  const [picker, setPicker] = useState<Nav["picker"]>(null);

  const openPatient = useCallback((id: number, label: string, section: Section = "activity") => {
    setOpen((o) => (o.some((x) => x.id === id) ? o.map((x) => (x.id === id ? { id, label } : x)) : [{ id, label }, ...o].slice(0, 8)));
    setView({ name: "patient", id, section });
  }, []);

  const value: Nav = {
    view,
    go: setView,
    openPatient,
    openAccounts,
    closeAccount: (id) => {
      setOpen((o) => o.filter((x) => x.id !== id));
      setView((v) => (v.name === "patient" && v.id === id ? { name: "home" } : v));
    },
    pickPatient: (purpose, then) => setPicker({ purpose, then }),
    picker,
    closePicker: () => setPicker(null),
    reset: () => {
      setOpen([]);
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
