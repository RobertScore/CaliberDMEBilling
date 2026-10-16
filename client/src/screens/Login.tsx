import { useState } from "react";
import { post } from "@/lib/api";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-600">
      <form
        className="w-80 space-y-3 rounded-lg bg-white p-6 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await post("/api/auth/login", { email, password });
            onLoggedIn();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <div className="text-lg font-bold text-navy-800">Caliber DME Billing</div>
          <div className="text-[12px] text-slate-500">Staff sign in</div>
        </div>
        <input className="input w-full" type="email" placeholder="Email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input w-full" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-[12px] text-red-700">{error}</div>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div className="rounded bg-amber-50 p-2 text-[11px] text-amber-900">Local demo: fake data only. Demo logins are printed in the Terminal window and saved in data/DEMO_LOGINS.txt.</div>
      </form>
    </div>
  );
}
