import { useState } from "react";
import { ShieldCheck, Database, Receipt } from "lucide-react";
import { post } from "@/lib/api";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-navy-500/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 font-bold text-navy-950">C</div>
            <div className="font-semibold">Caliber DME Billing</div>
          </div>
          <div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Billing that follows the work.</h1>
            <p className="mt-4 max-w-md text-navy-200">Register the patient, post the charges, post the payments. Every step in one place, for every client you bill for.</p>
            <ul className="mt-10 space-y-4 text-sm text-navy-100">
              <li className="flex items-center gap-3"><Database size={18} className="text-accent-300" /> Each client's data lives in its own locked-off database</li>
              <li className="flex items-center gap-3"><ShieldCheck size={18} className="text-accent-300" /> Every view and change is recorded in an audit log</li>
              <li className="flex items-center gap-3"><Receipt size={18} className="text-accent-300" /> Built for Work Comp and VA, ready for every payer</li>
            </ul>
          </div>
          <div className="text-xs text-navy-400">© Caliber DME Billing</div>
        </div>
      </div>
      <div className="flex items-center justify-center bg-canvas p-8">
        <form
          className="w-full max-w-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await post("/api/auth/login", { email: email.trim(), password: password.trim() });
              onLoggedIn();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your Caliber staff account.</p>
          <div className="mt-8 space-y-4">
            <label className="field"><span className="label">Email</span><input className="input h-11" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@caliber.test" /></label>
            <label className="field"><span className="label">Password</span><input className="input h-11" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button className="btn btn-primary h-11 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </div>
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <b>Local demo: fake data only.</b> Demo logins are printed in the Terminal window and saved in <span className="font-mono">data/DEMO_LOGINS.txt</span>.
          </div>
        </form>
      </div>
    </div>
  );
}
