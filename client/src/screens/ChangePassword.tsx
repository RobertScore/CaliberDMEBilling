// Shown after signing in with a temporary password. Nothing else works until it's changed.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ErrorBox, Field } from "@/components/inputs";

export function ChangePassword() {
  const s = useSession();
  const qc = useQueryClient();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const m = useMutation({ mutationFn: () => post("/api/auth/change-password", { currentPassword: cur, newPassword: next }), onSuccess: () => qc.refetchQueries({ queryKey: ["session"] }) });
  const mismatch = again.length > 0 && next !== again;
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <form className="card w-full max-w-md p-8" onSubmit={(e) => { e.preventDefault(); if (!mismatch) m.mutate(); }}>
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700"><KeyRound size={20} /></span>
        <h1 className="text-xl font-semibold text-slate-900">Choose your own password</h1>
        <p className="mt-1 text-sm text-slate-500">Hi {s.user.name}. You signed in with a temporary password. Pick a new one to continue: at least 12 characters, with letters and a number.</p>
        <div className="mt-6 space-y-4">
          <Field label="Temporary password"><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus /></Field>
          <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="New password again"><input className={`input ${mismatch ? "border-red-400" : ""}`} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
          {mismatch && <div className="text-xs text-red-600">The two new passwords don't match.</div>}
          <ErrorBox error={m.error} />
          <button className="btn btn-primary w-full" disabled={!cur || next.length < 12 || mismatch || m.isPending}>Save and continue</button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => post("/api/auth/logout").finally(() => window.location.reload())}>Sign out</button>
        </div>
      </form>
    </div>
  );
}
