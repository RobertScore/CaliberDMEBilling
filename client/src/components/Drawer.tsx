// A panel that slides in from the right over the current screen, so the ledger behind it stays in view.
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Drawer({ title, subtitle, onClose, children, width = "min(1040px, 94vw)" }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Esc closes the panel, unless a dialog inside it is open (it handles Esc itself).
      if (e.key === "Escape" && !document.querySelector("[data-modal-open]")) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-navy-950/25" onMouseDown={onClose} />
      <div role="dialog" aria-label={title} className="relative flex h-full flex-col bg-slate-50 shadow-2xl animate-[slideIn_160ms_ease-out]" style={{ width }}>
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
          </div>
          <span className="hidden text-2xs text-slate-400 sm:inline">Esc to close</span>
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close panel"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
