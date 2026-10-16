// Shows a stored document (PDF or image) inline. The file comes decrypted from the server; every view is logged.
import { useState } from "react";
import { ExternalLink, ZoomIn, ZoomOut } from "lucide-react";

export function DocumentViewer({ documentId, mimeType, height = "70vh" }: { documentId: number; mimeType: string; height?: string }) {
  const [zoom, setZoom] = useState(1);
  const url = `/api/documents/${documentId}/file`;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ height }}>
      <div className="flex items-center justify-end gap-1 border-b border-slate-200 bg-white px-2 py-1">
        {mimeType.startsWith("image/") && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"><ZoomOut size={14} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in"><ZoomIn size={14} /></button>
          </>
        )}
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
      </div>
      {mimeType === "application/pdf" ? (
        <iframe title="Document" src={url} className="h-full w-full bg-white" />
      ) : mimeType.startsWith("image/") && mimeType !== "image/tiff" && mimeType !== "image/heic" ? (
        <div className="flex-1 overflow-auto p-3">
          <img src={url} alt="Document" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} className="max-w-full bg-white shadow" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
          This file type can't be previewed in the browser. Use “Open” to download it.
        </div>
      )}
    </div>
  );
}
