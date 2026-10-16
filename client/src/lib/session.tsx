import { createContext, useContext, type ReactNode } from "react";
import type { SessionInfo } from "./types";

const Ctx = createContext<SessionInfo | null>(null);

export function SessionProvider({ value, children }: { value: SessionInfo; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The logged-in user. can() only hides buttons: the server checks every permission again. */
export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return { ...s, can: (p: string) => s.permissions.includes(p) };
}
