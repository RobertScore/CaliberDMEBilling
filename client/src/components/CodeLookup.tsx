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
}: {
  kind: "hcpcs" | "icd10";
  value: string;
  onPick: (code: string, description: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const q = text.trim();
  const { data } = useQuery({
    queryKey: ["codes", kind, q],
    queryFn: () => get<Code[]>(`/api/codes/${kind}?q=${encodeURIComponent(q)}`),
    enabled: open && q.length >= 1,
  });
  return (
    <div className={`relative ${className}`}>
      <input
        className="input w-full font-mono"
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setText(v);
          setOpen(true);
          onPick(v, "");
        }}
      />
      {open && data && data.length > 0 && (
        <div className="absolute z-30 mt-0.5 max-h-60 w-96 overflow-y-auto rounded border border-slate-300 bg-white shadow-lg">
          {data.map((c) => {
            const desc = c.shortDescription ?? c.description ?? "";
            return (
              <button
                type="button"
                key={c.code}
                className="block w-full px-2 py-1 text-left hover:bg-navy-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setText(c.code);
                  setOpen(false);
                  onPick(c.code, desc);
                }}
              >
                <span className="font-mono font-semibold">{c.code}</span> <span className="text-slate-600">{desc}</span>
                {c.source.startsWith("STARTER") && <span className="ml-1 text-[10px] text-amber-700">(starter list)</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
