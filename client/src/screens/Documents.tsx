// A patient's documents: the have / missing checklist, the files, a viewer, upload, type and verify.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Circle, Upload, ShieldCheck, FileText } from "lucide-react";
import { get, api, uploadFiles } from "@/lib/api";
import type { Checklist, Doc } from "@/lib/types";
import { useSession } from "@/lib/session";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Badge, EmptyState, useToast } from "@/components/ui";
import { ErrorBox, Select } from "@/components/inputs";
import { DOC_TYPES as ALL_TYPES } from "@shared/documents";

const DOC_TYPES = ALL_TYPES.filter((d) => d.code !== "packet");

export function ChecklistCard({ checklist, onOpen }: { checklist: Checklist; onOpen?: (docId: number) => void }) {
  return (
    <div className="space-y-1.5">
      {checklist.items.length === 0 && <div className="text-sm text-slate-400">No requirements set for this payer type. (Settings → Document requirements)</div>}
      {checklist.items.map((i) => (
        <button
          key={i.docType}
          disabled={!i.documentId || !onOpen}
          onClick={() => i.documentId && onOpen?.(i.documentId)}
          className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm enabled:hover:bg-slate-50"
        >
          {i.status === "verified" ? <CheckCircle2 size={16} className="text-accent-600" /> : i.status === "received" ? <CircleDashed size={16} className="text-amber-500" /> : <Circle size={16} className="text-red-400" />}
          <span className={`flex-1 ${i.status === "missing" ? "text-slate-500" : "text-slate-800"}`}>{i.label}</span>
          <span className={`text-2xs ${i.status === "verified" ? "text-accent-700" : i.status === "received" ? "text-amber-700" : "text-red-600"}`}>
            {i.status === "verified" ? "Verified" : i.status === "received" ? "Needs check" : "Missing"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Documents({ patientId, focusDocId }: { patientId: number; focusDocId?: number | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<number | null>(focusDocId ?? null);
  const [uploadType, setUploadType] = useState("other");
  const q = useQuery({ queryKey: ["documents", patientId], queryFn: () => get<{ documents: Doc[]; checklist: Checklist }>(`/api/patients/${patientId}/documents`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["documents", patientId] });
    qc.invalidateQueries({ queryKey: ["overview", patientId] });
  };
  const uploadM = useMutation({
    mutationFn: (files: File[]) => uploadFiles<Doc[]>(`/api/patients/${patientId}/documents`, files, { docType: uploadType }),
    onSuccess: (docs) => {
      refresh();
      setSelected(docs[0]?.id ?? null);
      toast(`${docs.length} document${docs.length > 1 ? "s" : ""} uploaded. Check the type, then mark verified.`);
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => api("PATCH", `/api/documents/${id}`, body),
    onSuccess: refresh,
  });

  const docs = q.data?.documents ?? [];
  const current = docs.find((d) => d.id === selected) ?? docs[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="card-title">Ready-to-bill checklist</div>
            {q.data?.checklist.complete ? <Badge tone="green">Complete</Badge> : <Badge tone="amber">{(q.data?.checklist.missingCount ?? 0) + (q.data?.checklist.unverifiedCount ?? 0)} to do</Badge>}
          </div>
          {q.data && <ChecklistCard checklist={q.data.checklist} onOpen={setSelected} />}
        </div>
        {can("document.upload") && (
          <div className="card p-4">
            <div className="card-title mb-3">Add a document</div>
            <Select value={uploadType} onChange={setUploadType} options={DOC_TYPES} />
            <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.length && uploadM.mutate([...e.target.files])} />
            <button
              className="mt-2 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-5 text-sm text-slate-500 hover:border-navy-300 hover:text-navy-700"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) uploadM.mutate([...e.dataTransfer.files]);
              }}
            >
              <Upload size={18} /> {uploadM.isPending ? "Uploading…" : "Drop files or click to choose"}
              <span className="text-2xs text-slate-400">PDF or image, up to 25 MB</span>
            </button>
            <div className="mt-2"><ErrorBox error={uploadM.error} /></div>
          </div>
        )}
        <div className="card">
          <div className="card-head"><div className="card-title">All documents</div><span className="text-xs text-slate-400">{docs.length}</span></div>
          <ul className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {docs.map((d) => (
              <li key={d.id}>
                <button className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${current?.id === d.id ? "bg-navy-50" : "hover:bg-slate-50"}`} onClick={() => setSelected(d.id)}>
                  <FileText size={15} className="text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-800">{d.typeLabel}</span>
                    <span className="block truncate text-2xs text-slate-400">{new Date(d.receivedAt).toLocaleDateString()} · {d.source} · {d.pageFrom ? `pages ${d.pageFrom}-${d.pageTo} of a packet` : d.originalName}</span>
                  </span>
                  {d.verifiedAt ? <ShieldCheck size={15} className="text-accent-600" /> : <span className="h-2 w-2 rounded-full bg-amber-400" title="Needs check" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        {!current ? (
          <div className="card"><EmptyState icon={<FileText size={20} />} title="No documents yet" body="Upload paperwork here, or file it from the Inbox." /></div>
        ) : (
          <>
            <div className="card flex flex-wrap items-center gap-3 p-3">
              <div className="w-72">
                <Select value={current.docType} onChange={(v) => patch.mutate({ id: current.id, body: { docType: v } })} options={DOC_TYPES} disabled={!can("document.verify")} />
              </div>
              {current.verifiedAt ? (
                <span className="flex items-center gap-1.5 text-sm text-accent-700"><ShieldCheck size={16} /> Verified by {current.verifiedBy} on {new Date(current.verifiedAt).toLocaleDateString()}</span>
              ) : (
                <button className="btn btn-accent btn-sm" disabled={!can("document.verify")} onClick={() => patch.mutate({ id: current.id, body: { verified: true } })}>
                  <ShieldCheck size={14} /> Mark verified (right type, complete, readable)
                </button>
              )}
              {current.verifiedAt && can("document.verify") && <button className="btn btn-ghost btn-sm" onClick={() => patch.mutate({ id: current.id, body: { verified: false } })}>Undo</button>}
              <span className="ml-auto text-xs text-slate-400">Received {new Date(current.receivedAt).toLocaleString()} via {current.source} · by {current.uploadedBy}</span>
            </div>
            <ErrorBox error={patch.error} />
            <DocumentViewer documentId={current.id} mimeType={current.mimeType} />
          </>
        )}
      </div>
    </div>
  );
}
