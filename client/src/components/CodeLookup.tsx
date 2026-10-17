import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Code } from "@/lib/types";

/** Type a code or words; pick from the list. Used for HCPCS and ICD-10. */
export function CodeLookup({
  kind,
  value,
  onPick,
  className = "",
  placeholder,
  autoFocus,
  on,
}: {
  kind: "hcpcs" | "icd10";
  value: string;
  onPick: (code: string, description: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Date of service: only codes valid on that day are offered. */
  on?: string;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const q = text.trim();
  const { data } = useQuery({
    queryKey: ["codes", kind, q, on],
    queryFn: () => get<Code[]>(`/api/codes/${kind}?q=${encodeURIComponent(q)}${on ? `&on=${on}` : ""}`),
    enabled: open && q.length >= 1,
  });
  return (
    <div className={`relative ${className}`}>
      <input
        className="input w-full font-mono uppercase placeholder:font-sans placeholder:normal-case"
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          // Enter picks the top match, so codes can be entered without the mouse.
          const first = data?.find((c) => c.billable !== false);
          if (e.key === "Enter" && open && first) {
            e.preventDefault();
            const c = first;
            setText(c.code);
            setOpen(false);
            onPick(c.code, c.shortDescription ?? c.description ?? "");
          }
        }}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setText(v);
          setOpen(true);
          onPick(v, "");
        }}
      />
      {open && data && data.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-[34rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lift">
          {data.map((c) => {
            const desc = c.shortDescription ?? c.description ?? "";
            const full = kind === "hcpcs" ? c.longDescription ?? desc : c.description ?? desc;
            const header = c.billable === false;
            return (
              <button
                type="button"
                key={`${c.code}-${c.effectiveFrom ?? ""}`}
                disabled={header}
                title={header ? "A category, not a billable code: pick a more specific code under it" : full}
                className="block w-full rounded-md px-3 py-2 text-left text-sm enabled:hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setText(c.code);
                  setOpen(false);
                  onPick(c.code, desc);
                }}
              >
                <span className="font-mono font-semibold text-navy-800">{c.code}</span> <span className="text-slate-600">{full}</span>
                {header && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-600">category, not billable</span>}
                {c.effectiveTo && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">ends {c.effectiveTo}</span>}
                {c.source.startsWith("STARTER") && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">starter list</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
