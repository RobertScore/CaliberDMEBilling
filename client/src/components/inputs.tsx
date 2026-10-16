import { useEffect, useState, type ReactNode } from "react";
import { autoSlashDate, displayToIso, isoToDisplay } from "@shared/dates";
import { formatCents, parseDollarsToCents } from "@shared/money";

export function Field({ label, children, className = "", hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">
        {label}
        {hint && <span className="ml-1 font-normal normal-case text-slate-400">{hint}</span>}
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
      className={`input ${className}`}
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
    <div className="flex items-center gap-1">
      <input
        className={`input w-28 ${bad ? "border-red-500" : ""} ${className}`}
        value={text}
        placeholder="MM/DD/YYYY"
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
      <input
        type="date"
        aria-label="Pick from calendar"
        className="h-7 w-7 cursor-pointer rounded border border-slate-300 bg-white text-transparent [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:p-1"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        tabIndex={-1}
      />
    </div>
  );
}

/** Money box. Shows dollars, stores whole cents. */
export function MoneyInput({ cents, onChange, disabled, className = "" }: { cents: number | null | undefined; onChange: (c: number | undefined) => void; disabled?: boolean; className?: string }) {
  const [text, setText] = useState(cents != null ? formatCents(cents) : "");
  useEffect(() => {
    if (parseDollarsToCents(text) !== (cents ?? null)) setText(cents != null ? formatCents(cents) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  const parsed = parseDollarsToCents(text);
  return (
    <input
      className={`input text-right font-mono ${text && parsed === null ? "border-red-500" : ""} ${className}`}
      value={text}
      disabled={disabled}
      inputMode="decimal"
      placeholder="0.00"
      onChange={(e) => {
        setText(e.target.value);
        const c = parseDollarsToCents(e.target.value);
        onChange(c === null ? undefined : c);
      }}
      onBlur={() => parsed !== null && setText(formatCents(parsed))}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, disabled, className = "", blank }: { value: T | "" | null | undefined; onChange: (v: T) => void; options: readonly { code: T; label: string }[]; disabled?: boolean; className?: string; blank?: string }) {
  return (
    <select className={`input ${className}`} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-800">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`font-mono ${cents < 0 ? "text-red-700" : ""} ${className}`}>{formatCents(cents)}</span>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 pt-20" onMouseDown={onClose}>
      <div className={`panel w-full ${wide ? "max-w-3xl" : "max-w-lg"} shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <h2 className="font-semibold text-navy-800">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
