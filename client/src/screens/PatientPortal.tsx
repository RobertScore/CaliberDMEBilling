// The patient portal: a patient sees only their own account, sends photos of paperwork, and messages the office.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Loader2, MessageSquare, Send } from "lucide-react";
import { get, post, uploadFiles } from "@/lib/api";
import { PortalFrame } from "@/components/PortalFrame";
import { Badge, useToast } from "@/components/ui";
import { ErrorBox, Money } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

type Summary = {
  supplierName: string; firstName: string; lastName: string; accountNumber: string;
  insurances: { rank: number; payerName: string }[];
  claims: { id: number; serviceDateFrom: string; status: string; statusText: string; billedCents: number; paidCents: number; balanceCents: number }[];
  youOweCents: number; uploads: { id: number; type: string; receivedAt: string }[]; uploadsInReview: number;
};

export function PatientPortal() {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const q = useQuery({ queryKey: ["me"], queryFn: () => get<Summary>("/api/portal/me/summary") });
  const up = useMutation({ mutationFn: (files: File[]) => uploadFiles("/api/portal/me/uploads", files), onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast("Thanks! The billing office will review it."); } });
  const send = useMutation({ mutationFn: () => post("/api/portal/me/messages", { body: msg }), onSuccess: () => { setMsg(""); setSent(true); } });
  const s = q.data;
  return (
    <PortalFrame title="My account" tabs={[{ key: "home", label: "Overview" }]} tab="home" onTab={() => undefined}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ErrorBox error={q.error} />
        {s && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Hi {s.firstName}</h1>
            <p className="mt-1 text-sm text-slate-500">Your equipment from {s.supplierName} · Account #{s.accountNumber}</p>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="card p-5">
                <div className="card-title mb-2">Your balance</div>
                {/* ASSUMPTION Q-053: WC and VA patients generally can't be billed; the balance shown is only the patient share recorded by staff. */}
                <Money cents={s.youOweCents} className="text-3xl font-semibold text-navy-800" />
                <p className="mt-1 text-xs text-slate-500">{s.youOweCents > 0 ? "Questions about this? Send us a message below." : "You don't owe anything right now."}</p>
                <div className="mt-4 text-sm text-slate-600">{s.insurances.map((i) => <div key={i.rank}>{["Primary", "Secondary", "Tertiary"][i.rank - 1]} insurance: {i.payerName}</div>)}</div>
              </div>
              <div className="card p-5">
                <div className="card-title mb-2">Send us paperwork</div>
                <p className="mb-3 text-sm text-slate-500">Take a photo of a form, insurance card or letter and upload it here.</p>
                <input ref={ref} type="file" multiple accept="application/pdf,image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.length && up.mutate([...e.target.files])} />
                <button className="btn btn-primary w-full" onClick={() => ref.current?.click()} disabled={up.isPending}>{up.isPending ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Upload a photo or PDF</button>
                {s.uploadsInReview > 0 && <div className="mt-2 text-xs text-amber-700">{s.uploadsInReview} upload(s) being reviewed.</div>}
                <div className="mt-2"><ErrorBox error={up.error} /></div>
              </div>
            </div>
            <div className="card mt-5 overflow-hidden">
              <div className="card-head"><div className="card-title">Your claims</div></div>
              <ul className="divide-y divide-slate-50">
                {s.claims.map((c) => <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm"><span className="flex-1 text-slate-700">Equipment delivered {isoToDisplay(c.serviceDateFrom)}</span><Badge tone={c.status === "paid" ? "green" : "amber"}>{c.statusText}</Badge></li>)}
                {s.claims.length === 0 && <li className="px-5 py-5 text-sm text-slate-400">Nothing billed yet.</li>}
              </ul>
            </div>
            <div className="card mt-5 p-5">
              <div className="card-title mb-2 flex items-center gap-2"><MessageSquare size={16} className="text-slate-400" /> Message the billing office</div>
              {sent ? (
                <div className="flex items-center gap-2 text-sm text-accent-700"><CheckCircle2 size={16} /> Sent. Someone will get back to you. <button className="text-navy-700 underline" onClick={() => setSent(false)}>Send another</button></div>
              ) : (
                <>
                  <textarea className="input h-24 resize-none py-2" placeholder="Please don't include anything you wouldn't want on a form." value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
                  <div className="mt-2 flex items-center justify-between"><ErrorBox error={send.error} /><button className="btn btn-primary ml-auto" disabled={msg.trim().length < 2 || send.isPending} onClick={() => send.mutate()}><Send size={14} /> Send</button></div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </PortalFrame>
  );
}
