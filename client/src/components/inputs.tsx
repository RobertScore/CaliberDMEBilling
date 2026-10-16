import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, X, AlertCircle } from "lucide-react";
import { autoSlashDate, displayToIso, isoToDisplay } from "@shared/dates";
import { formatCents, parseDollarsToCents } from "@shared/money";

export function Field({ label, children, className = "", hint, required }: { label: string; children: ReactNode; className?: string; hint?: string; required?: boolean }) {
  return (
    <label className={`field ${className}`}>
      <span className="label flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-auto font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

type TextProps = {
  value: string | null | undefined;
  onChange: (v: string) => void;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  upper?: boolean;
  autoFocus?: boolean;
};

export function TextInput({ value, onChange, maxLength, className = "", disabled, placeholder, upper, autoFocus }: TextProps) {
  return (
    <input
      className={`input ${upper ? "uppercase placeholder:normal-case" : ""} ${className}`}
      value={value ?? ""}
      maxLength={maxLength}
      disabled={disabled}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

/** Date box with the spec's smart entry: type 010101 and slashes are added. Stores YYYY-MM-DD. */
export function DateInput({ value, onChange, disabled, className = "" }: { value: string | null | undefined; onChange: (iso: string | undefined) => void; disabled?: boolean; className?: string }) {
  const [text, setText] = useState(isoToDisplay(value));
  useEffect(() => {
    if ((displayToIso(text) ?? undefined) !== (value ?? undefined)) setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const iso = displayToIso(text);
  const bad = text.length > 0 && !iso && text.replace(/\D/g, "").length >= 6;
  return (
    <div className={`relative ${className}`}>
      <input
        className={`input pr-10 ${bad ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        value={text}
        placeholder="MM/DD/YYYY"
        inputMode="numeric"
        disabled={disabled}
        onChange={(e) => {
          const t = autoSlashDate(e.target.value);
          setText(t);
          // A full 8-digit date counts right away. A 6-digit one (010101) counts when you leave the box,
          // so a date that's still being typed is never saved half-finished.
          if (t.replace(/\D/g, "").length === 8) {
            const d = displayToIso(t);
            if (d) onChange(d);
          } else if (t === "") onChange(undefined);
        }}
        onBlur={() => {
          if (iso) {
            setText(isoToDisplay(iso));
            if (iso !== value) onChange(iso);
          }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        <CalendarDays size={16} />
      </span>
      <input
        type="date"
        aria-label="Pick from calendar"
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        tabIndex={-1}
      />
    </div>
  );
}

/** Money box. Shows dollars, stores whole cents. */
export function MoneyInput({ cents, onChange, disabled, className = "", autoFocus }: { cents: number | null | undefined; onChange: (c: number | undefined) => void; disabled?: boolean; className?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(cents != null ? formatCents(cents) : "");
  useEffect(() => {
    if (parseDollarsToCents(text) !== (cents ?? null)) setText(cents != null ? formatCents(cents) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  const parsed = parseDollarsToCents(text);
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
      <input
        className={`input money pl-7 text-right ${text && parsed === null ? "border-red-400" : ""}`}
        value={text}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder="0.00"
        onChange={(e) => {
          setText(e.target.value);
          const c = parseDollarsToCents(e.target.value);
          onChange(c === null ? undefined : c);
        }}
        onBlur={() => parsed !== null && setText(formatCents(parsed))}
      />
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, disabled, className = "", blank }: { value: T | "" | null | undefined; onChange: (v: T) => void; options: readonly { code: T; label: string }[]; disabled?: boolean; className?: string; blank?: string }) {
  return (
    <select className={`input pr-8 ${className}`} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Segmented choice, e.g. Sex F / M / U. */
export function Segmented<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: readonly { code: T; label: string }[]; disabled?: boolean }) {
  return (
    <div className="inline-flex h-10 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.code)}
          className={`rounded-md px-3 text-sm font-medium transition ${value === o.code ? "bg-white text-navy-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  // −$400.00 reads better than $-400.00
  return <span className={`money ${cents < 0 ? "text-red-600" : ""} ${className}`}>{cents < 0 ? "−" : ""}${formatCents(Math.abs(cents))}</span>;
}

export function Modal({ title, onClose, children, wide, subtitle }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; subtitle?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? "max-w-2xl" : "max-w-lg"} shadow-lift`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}
