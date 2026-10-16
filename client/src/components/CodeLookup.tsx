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
}: {
  kind: "hcpcs" | "icd10";
  value: string;
  onPick: (code: string, description: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
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
        className="input w-full font-mono uppercase placeholder:font-sans placeholder:normal-case"
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          // Enter picks the top match, so codes can be entered without the mouse.
          if (e.key === "Enter" && open && data && data[0]) {
            e.preventDefault();
            const c = data[0];
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
        <div className="absolute z-30 mt-1 max-h-64 w-[26rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lift">
          {data.map((c) => {
            const desc = c.shortDescription ?? c.description ?? "";
            return (
              <button
                type="button"
                key={c.code}
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-navy-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setText(c.code);
                  setOpen(false);
                  onPick(c.code, desc);
                }}
              >
                <span className="font-mono font-semibold text-navy-800">{c.code}</span> <span className="text-slate-600">{desc}</span>
                {c.source.startsWith("STARTER") && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">starter list</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
