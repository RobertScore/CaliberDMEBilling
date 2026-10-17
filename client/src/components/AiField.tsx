// A form field that shows where its value came from: read by the AI (purple), checked by a person (green),
// changed after the AI read it (amber) or typed by hand. Focusing an AI field jumps the document to where it was read.
import type { ReactNode } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import type { ExtractedField } from "@shared/documents";

export type Origin = "ai" | "checked" | "edited" | "typed" | "empty";

const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();

export function originOf(value: string, ai: ExtractedField | undefined, checked: boolean): Origin {
  if (ai?.value) {
    if (same(value, ai.value)) return checked ? "checked" : "ai";
    return "edited";
  }
  return value.trim() ? "typed" : "empty";
}

export const ORIGIN_INPUT: Record<Origin, string> = {
  ai: "!border-violet-400 bg-violet-50/60 focus:!ring-violet-200",
  checked: "!border-emerald-400 bg-emerald-50/40",
  edited: "!border-amber-400 bg-amber-50/50",
  typed: "",
  empty: "",
};

const DOT: Record<string, string> = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" };
const SURE: Record<string, string> = { high: "sure", medium: "fairly sure", low: "unsure" };

export function AiField({
  id, label, required, value, ai, aiText, checked, disabled, className = "", onChange, onCheck, onUndo, onLocate, onNext, children,
}: {
  id: string; label: string; required?: boolean; value: string; ai?: ExtractedField; /** How to show the AI's value, if not as-is (e.g. a payer name for a payer id). */ aiText?: string; checked: boolean; disabled?: boolean; className?: string;
  onChange: (v: string) => void; onCheck: () => void; onUndo: () => void; onLocate: () => void; onNext: () => void;
  /** Use a custom control (e.g. a select) instead of the text box. */
  children?: (props: { id: string; className: string; onFocus: () => void }) => ReactNode;
}) {
  const origin = originOf(value, ai, checked);
  const inputCls = `input ${ORIGIN_INPUT[origin]}`;
  const onFocus = () => ai?.value && onLocate();
  return (
    <div className={`field ${className}`}>
      <div className="label flex min-h-[18px] items-center gap-1.5">
        <label htmlFor={id} className="truncate">{label}{required && <span className="text-red-500"> *</span>}</label>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {origin === "ai" && (
            <>
              <button type="button" onClick={onLocate} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200" title={`Read by AI (${SURE[ai!.confidence]}). Click to see where on the document.`}>
                <Sparkles size={10} /> AI <span className={`h-1.5 w-1.5 rounded-full ${DOT[ai!.confidence]}`} />
              </button>
              {!disabled && (
                <button type="button" onClick={() => { onCheck(); onNext(); }} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-violet-300 bg-white text-violet-700 hover:bg-emerald-50 hover:text-emerald-700" title="It matches the paper (Enter)" aria-label={`${label} matches the paper`}>
                  <Check size={11} />
                </button>
              )}
            </>
          )}
          {origin === "checked" && (
            <button type="button" onClick={onLocate} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800" title="AI value, checked against the paper. Click to see where.">
              <Check size={10} /> AI · checked
            </button>
          )}
          {origin === "edited" && (
            <>
              <button type="button" onClick={onLocate} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title={`Changed by you. The AI read: “${aiText ?? ai!.value}”. Click to see where.`}>
                Edited
              </button>
              {!disabled && <button type="button" onClick={onUndo} className="rounded-full p-0.5 text-amber-700 hover:bg-amber-100" title="Put the AI's value back"><RotateCcw size={11} /></button>}
            </>
          )}
          {origin === "typed" && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="Typed by hand">Typed</span>}
        </span>
      </div>
      {children ? (
        children({ id, className: inputCls, onFocus })
      ) : (
        <input
          id={id}
          className={inputCls}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && origin === "ai") {
              e.preventDefault();
              onCheck();
              onNext();
            }
          }}
        />
      )}
      {origin === "edited" && <div className="mt-0.5 truncate text-[11px] text-amber-700" title={aiText ?? ai!.value ?? ""}>AI read: “{aiText ?? ai!.value}”</div>}
    </div>
  );
}
