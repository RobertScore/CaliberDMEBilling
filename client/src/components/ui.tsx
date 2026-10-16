import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X, Check } from "lucide-react";

const COVERAGE: Record<string, { label: string; cls: string }> = {
  WC: { label: "Workers' Comp", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  VA_DIRECT: { label: "VA", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  VA_CCN: { label: "VA Community Care", cls: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  MEDICARE: { label: "Medicare", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  MEDICAID: { label: "Medicaid", cls: "bg-teal-50 text-teal-800 ring-teal-200" },
  COMMERCIAL: { label: "Commercial", cls: "bg-violet-50 text-violet-800 ring-violet-200" },
  SELF_PAY: { label: "Self-pay", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
};

export function CoverageBadge({ type }: { type: string }) {
  const c = COVERAGE[type] ?? { label: type, cls: "bg-slate-100 text-slate-700 ring-slate-200" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ${c.cls}`}>{c.label}</span>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "navy" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-accent-50 text-accent-800 ring-accent-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    navy: "bg-navy-50 text-navy-700 ring-navy-200",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

/** Initials in a colored circle, so accounts are easy to tell apart at a glance. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const parts = name.replace(/[^A-Za-z ,]/g, "").split(/[ ,]+/).filter(Boolean);
  const initials = ((parts[1]?.[0] ?? "") + (parts[0]?.[0] ?? "")).toUpperCase() || "?";
  const hues = ["bg-navy-100 text-navy-800", "bg-accent-100 text-accent-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800"];
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${hue}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-600">{icon}</div>
      <div className="font-semibold text-slate-900">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Numbered step header used in the guided forms. */
export function StepHeader({ n, title, subtitle, done }: { n: number; title: string; subtitle?: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-accent-600 text-white" : "bg-navy-800 text-white"}`}>
        {done ? <Check size={14} /> : n}
      </span>
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
    </div>
  );
}

// Toasts: short confirmations that fade away ("Payment posted").
type Toast = { id: number; text: string; tone: "success" | "warning" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "warning" ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lift ${t.tone === "warning" ? "border-amber-200" : "border-accent-200"}`}>
            {t.tone === "warning" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent-600" />}
            <span className="text-slate-800">{t.text}</span>
            <button className="ml-auto text-slate-400 hover:text-slate-700" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
